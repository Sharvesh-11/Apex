from datetime import datetime, date, timedelta
from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import Date, cast
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.core.config import settings
from app.database import get_db
from app.models.attendance import AttendanceLog, AttendanceMethod
from app.models.member import Member
from app.models.user import User
from app.schemas.attendance import (
	AttendanceOut,
	AttendanceResponse,
	CheckInPinRequest,
	CheckInResponse,
)


router = APIRouter()


def _attendance_to_out(log: AttendanceLog) -> AttendanceOut:
	return AttendanceOut(
		id=log.id,
		member_id=log.member_id,
		checked_in_at=log.checked_in_at,
		method=getattr(log.method, "value", log.method),
	)


def _current_role(user: User) -> str:
	return getattr(user.role, "value", user.role)


def update_streak(member: Member, db: Session) -> None:
	from datetime import date, timedelta

	today = date.today()

	if member.last_checkin_date is None:
		member.current_streak = 1
	elif member.last_checkin_date == today:
		# Already checked in today — no change
		pass
	elif member.last_checkin_date == today - timedelta(days=1):
		# Consecutive day
		member.current_streak += 1
	else:
		# Streak reset
		member.current_streak = 1

	if member.current_streak > member.longest_streak:
		member.longest_streak = member.current_streak

	member.last_checkin_date = today

	db.commit()
	db.refresh(member)


@router.post("/checkin/pin", response_model=CheckInResponse)
def checkin_by_pin(data: CheckInPinRequest, db: Session = Depends(get_db)) -> CheckInResponse:
	member = db.query(Member).filter(Member.pin == data.pin).first()
	if member is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

	log = AttendanceLog(member_id=member.id, method=AttendanceMethod.pin)
	db.add(log)
	db.commit()
	db.refresh(log)

	# Update member streaks after successful check-in
	update_streak(member, db)

	return CheckInResponse(
		message="Check-in successful",
		member_name=member.full_name,
		time=log.checked_in_at,
	)


@router.get("/", response_model=list[AttendanceOut])
def list_attendance_logs(
	member_id: UUID | None = None,
	date: date | None = None,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> list[AttendanceOut]:
	query = db.query(AttendanceLog)
	if member_id is not None:
		query = query.filter(AttendanceLog.member_id == member_id)
	if date is not None:
		query = query.filter(cast(AttendanceLog.checked_in_at, Date) == date)

	logs = query.order_by(AttendanceLog.checked_in_at.desc()).all()
	return [_attendance_to_out(log) for log in logs]


@router.get("/member/{member_id}", response_model=list[AttendanceOut])
def list_member_attendance(
	member_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_user),
) -> list[AttendanceOut]:
	member = db.query(Member).filter(Member.id == member_id).first()
	if member is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

	current_role = _current_role(current_user)
	is_admin = current_role in {"gym_owner", "admin"}
	is_self_member = current_role == "gym_member" and member.user_id == current_user.id
	if not is_admin and not is_self_member:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

	logs = (
		db.query(AttendanceLog)
		.filter(AttendanceLog.member_id == member_id)
		.order_by(AttendanceLog.checked_in_at.desc())
		.all()
	)
	return [_attendance_to_out(log) for log in logs]


@router.get("/gym-qr/")
def get_gym_qr(current_user: User = Depends(require_role("gym_owner", "admin"))):
	"""Return gym-wide checkin URL and printing instructions to owners/admins."""
	frontend = getattr(settings, "FRONTEND_URL", "https://apex.zenith-labs.app")
	return {
		"checkin_url": f"{frontend}/checkin",
		"instructions": "Print this QR and place it at gym entrance",
	}


@router.post("/checkin/")
def qr_checkin(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("gym_member")),
):
    # Find the Member row for this user
    member = db.query(Member).filter(Member.user_id == current_user.id).first()
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    today = date.today()

    # Duplicate check — cast checked_in_at to date
    existing = (
        db.query(AttendanceLog)
        .filter(
            AttendanceLog.member_id == member.id,
            cast(AttendanceLog.checked_in_at, Date) == today,
        )
        .first()
    )

    if existing:
        return {
            "success": True,
            "already_checked_in": True,
            "member_name": member.full_name,
			"current_streak": member.current_streak,
            "message": "Already checked in today",
        }

    # Create new record
    log = AttendanceLog(
        member_id=member.id,
        method=AttendanceMethod.qr,  # uses your existing enum
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    # Update streaks after successful check-in
    update_streak(member, db)

    return {
        "success": True,
        "already_checked_in": False,
        "member_name": member.full_name,
		"current_streak": member.current_streak,
        "checked_in_at": log.checked_in_at.isoformat(),
        "message": "Checked in successfully",
    }


@router.post("/checkin/gym")
def gym_checkin(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("gym_member")),
):
	# Find the Member row for this user
	member = db.query(Member).filter(Member.user_id == current_user.id).first()
	if member is None:
		raise HTTPException(status_code=404, detail="Member not found")

	# Find latest attendance for spam prevention
	last = (
		db.query(AttendanceLog)
		.filter(AttendanceLog.member_id == member.id)
		.order_by(AttendanceLog.checked_in_at.desc())
		.first()
	)
	if last is not None:
		now = datetime.now(tz=last.checked_in_at.tzinfo) if getattr(last.checked_in_at, "tzinfo", None) else datetime.now()
		next_checkin_at = last.checked_in_at + timedelta(hours=6)
		if now < next_checkin_at:
			raise HTTPException(status_code=400, detail={
				"already_checked_in": True,
				"message": "Already checked in",
				"next_checkin_at": str(next_checkin_at),
			})

	# Create new attendance log
	log = AttendanceLog(member_id=member.id, method=AttendanceMethod.qr)
	db.add(log)
	db.commit()
	db.refresh(log)

	# Update streaks
	update_streak(member, db)

	return {
		"success": True,
		"member_name": member.full_name,
		"checked_in_at": str(log.checked_in_at),
		"current_streak": member.current_streak,
		"message": "Check-in successful",
	}



@router.get("/me/", response_model=List[AttendanceResponse])
def get_my_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("gym_member")),
):
    member = db.query(Member).filter(Member.user_id == current_user.id).first()
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    logs = (
        db.query(AttendanceLog)
        .filter(AttendanceLog.member_id == member.id)
        .order_by(AttendanceLog.checked_in_at.desc())
        .limit(30)
        .all()
    )

    return [
        AttendanceResponse(
            id=log.id,
            member_id=log.member_id,
            date=log.checked_in_at.date(),
            time=log.checked_in_at.time(),
            method=getattr(log.method, "value", log.method),
            created_at=log.checked_in_at,
        )
        for log in logs
    ]
