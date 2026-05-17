import secrets
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.member import Member
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User
from app.schemas.subscription import SubscriptionOut
from app.schemas.members import MemberCreate, MemberOut, MemberUpdate
from app.schemas.users import UserCreate
from app.services.auth_service import register_user


router = APIRouter()


def _member_to_out(member: Member) -> MemberOut:
	return MemberOut(
		id=member.id,
		user_id=member.user_id,
		full_name=member.full_name,
		phone=member.phone,
		profile_photo_url=member.profile_photo_url,
		pin=member.pin,
		joined_at=member.joined_at,
		is_active=member.is_active,
		email=member.user.email,
		role=getattr(member.user.role, "value", member.user.role) if getattr(member, "user", None) else None,
	)


@router.get("/", response_model=list[MemberOut])
def list_members(
	is_active: Optional[bool] = None,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> list[MemberOut]:
	query = db.query(Member).options(joinedload(Member.user))
	if is_active is not None:
		query = query.filter(Member.is_active == is_active)
	members = query.order_by(Member.full_name.asc()).all()
	return [_member_to_out(member) for member in members]


@router.get("/me", response_model=MemberOut)
def get_current_member(
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_member")),
) -> MemberOut:
	"""Get the current member's profile. Protected: gym_member only."""
	member = (
		db.query(Member)
		.options(joinedload(Member.user))
		.filter(Member.user_id == current_user.id)
		.first()
	)
	if member is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member profile not found")
	return _member_to_out(member)


@router.get("/{member_id}", response_model=MemberOut)
def get_member(
	member_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> MemberOut:
	member = (
		db.query(Member)
		.options(joinedload(Member.user))
		.filter(Member.id == member_id)
		.first()
	)
	if member is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
	return _member_to_out(member)


@router.post("/", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def create_member(
	data: MemberCreate,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> MemberOut:
	user_data = UserCreate(
		email=data.email,
		password=data.password,
		role="gym_member",
		full_name=data.full_name,
		phone=data.phone,
	)
	user = register_user(db, user_data)

	member = (
		db.query(Member)
		.options(joinedload(Member.user))
		.filter(Member.user_id == user.id)
		.first()
	)
	if member is None:
		raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Member could not be created")

	member.pin = f"{secrets.randbelow(10000):04d}"
	db.commit()
	db.refresh(member)
	return _member_to_out(member)


@router.put("/{member_id}", response_model=MemberOut)
def update_member(
	member_id: UUID,
	data: MemberUpdate,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> MemberOut:
	member = (
		db.query(Member)
		.options(joinedload(Member.user))
		.filter(Member.id == member_id)
		.first()
	)
	if member is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

	if data.full_name is not None:
		member.full_name = data.full_name
	if data.phone is not None:
		member.phone = data.phone
	if data.is_active is not None:
		member.is_active = data.is_active
		member.user.is_active = data.is_active

	db.commit()
	db.refresh(member)
	return _member_to_out(member)


@router.delete("/{member_id}")
def delete_member(
	member_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> dict[str, str]:
	member = db.query(Member).filter(Member.id == member_id).first()
	if member is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

	member.is_active = False
	member.user.is_active = False
	db.commit()
	return {"message": "Member deactivated"}





@router.get("/{member_id}/subscription", response_model=SubscriptionOut)
def get_member_active_subscription(
	member_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> SubscriptionOut:
	subscription = (
		db.query(Subscription)
		.options(joinedload(Subscription.plan))
		.filter(Subscription.member_id == member_id, Subscription.status == SubscriptionStatus.active)
		.order_by(Subscription.created_at.desc())
		.first()
	)
	if subscription is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active subscription")
	return SubscriptionOut.model_validate(subscription)
