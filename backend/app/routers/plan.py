from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.database import get_db
from app.models.plan import BillingCycle, Plan
from app.models.user import User
from app.schemas.plan import PlanCreate, PlanOut, PlanUpdate


router = APIRouter()


def _plan_to_out(plan: Plan) -> PlanOut:
	return PlanOut.model_validate(plan)


def _parse_billing_cycle(value: str) -> BillingCycle:
	try:
		return BillingCycle(value)
	except ValueError:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Invalid billing cycle",
		)


@router.get("/", response_model=list[PlanOut])
def list_active_plans(db: Session = Depends(get_db)) -> list[PlanOut]:
	plans = db.query(Plan).filter(Plan.is_active.is_(True)).order_by(Plan.created_at.desc()).all()
	return [_plan_to_out(plan) for plan in plans]


@router.get("/all", response_model=list[PlanOut])
def list_all_plans(
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> list[PlanOut]:
	plans = db.query(Plan).order_by(Plan.created_at.desc()).all()
	return [_plan_to_out(plan) for plan in plans]


@router.post("/", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
def create_plan(
	data: PlanCreate,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> PlanOut:
	plan = Plan(
		name=data.name,
		description=data.description,
		price=data.price,
		billing_cycle=_parse_billing_cycle(data.billing_cycle),
		is_active=True,
	)
	db.add(plan)
	db.commit()
	db.refresh(plan)
	return _plan_to_out(plan)


@router.put("/{plan_id}", response_model=PlanOut)
def update_plan(
	plan_id: UUID,
	data: PlanUpdate,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> PlanOut:
	plan = db.query(Plan).filter(Plan.id == plan_id).first()
	if plan is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

	if data.name is not None:
		plan.name = data.name
	if data.description is not None:
		plan.description = data.description
	if data.price is not None:
		plan.price = data.price
	if data.is_active is not None:
		plan.is_active = data.is_active

	db.commit()
	db.refresh(plan)
	return _plan_to_out(plan)


@router.delete("/{plan_id}")
def delete_plan(
	plan_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> dict[str, str]:
	plan = db.query(Plan).filter(Plan.id == plan_id).first()
	if plan is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

	plan.is_active = False
	db.commit()
	return {"message": "Plan deactivated"}
