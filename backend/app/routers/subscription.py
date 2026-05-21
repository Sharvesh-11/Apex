from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import require_role
from app.database import get_db
from app.models.member import Member
from app.models.plan import BillingCycle, Plan
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User
from app.models.payment import Payment
from app.schemas.subscription import SubscriptionCreate, SubscriptionOut


router = APIRouter()


def _subscription_to_out(subscription: Subscription) -> SubscriptionOut:
	return SubscriptionOut.model_validate(subscription)


def _billing_cycle_days(billing_cycle: BillingCycle) -> int:
	cycle_value = getattr(billing_cycle, "value", billing_cycle)
	if cycle_value == "monthly":
		return 30
	if cycle_value == "half_yearly":
		return 180
	if cycle_value == "annual":
		return 365
	raise HTTPException(
		status_code=status.HTTP_400_BAD_REQUEST,
		detail="Invalid billing cycle",
	)


@router.post("/", response_model=SubscriptionOut, status_code=status.HTTP_201_CREATED)
def create_subscription(
	data: SubscriptionCreate,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> SubscriptionOut:
	member = db.query(Member).filter(Member.id == data.member_id).first()
	if member is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

	plan = db.query(Plan).filter(Plan.id == data.plan_id).first()
	if plan is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

	end_date = data.start_date + timedelta(days=_billing_cycle_days(plan.billing_cycle))
	subscription = Subscription(
		member_id=data.member_id,
		plan_id=data.plan_id,
		start_date=data.start_date,
		end_date=end_date,
		status=SubscriptionStatus.active,
	)
	db.add(subscription)
	db.commit()
	db.refresh(subscription)

	subscription = (
		db.query(Subscription)
		.options(joinedload(Subscription.plan))
		.filter(Subscription.id == subscription.id)
		.first()
	)
	return _subscription_to_out(subscription)


@router.get("/member/{member_id}", response_model=list[SubscriptionOut])
def list_member_subscriptions(
	member_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin", "gym_member")),
) -> list[SubscriptionOut]:
	subscriptions = (
		db.query(Subscription)
		.options(joinedload(Subscription.plan))
		.filter(Subscription.member_id == member_id)
		.order_by(Subscription.created_at.desc())
		.all()
	)
	return [_subscription_to_out(subscription) for subscription in subscriptions]

@router.delete("/{subscription_id}")
def delete_subscription(
    subscription_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("gym_owner", "admin")),
) -> dict:
    subscription = db.query(Subscription).filter(
        Subscription.id == subscription_id
    ).first()
    if subscription is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Subscription not found"
        )
    
    # Delete linked payments first to avoid foreign key violation
    from app.models.payment import Payment
    db.query(Payment).filter(
        Payment.subscription_id == subscription_id
    ).delete(synchronize_session=False)
    
    db.delete(subscription)
    db.commit()
    return {"message": "Subscription log deleted"}


@router.get("/active", response_model=list[SubscriptionOut])
def list_active_subscriptions(
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> list[SubscriptionOut]:
	subscriptions = (
		db.query(Subscription)
		.options(joinedload(Subscription.plan))
		.filter(Subscription.status == SubscriptionStatus.active)
		.order_by(Subscription.created_at.desc())
		.all()
	)
	return [_subscription_to_out(subscription) for subscription in subscriptions]


@router.put("/{subscription_id}/cancel", response_model=SubscriptionOut)
def cancel_subscription(
	subscription_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> SubscriptionOut:
	subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
	if subscription is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

	subscription.status = SubscriptionStatus.cancelled
	db.commit()
	db.refresh(subscription)

	subscription = (
		db.query(Subscription)
		.options(joinedload(Subscription.plan))
		.filter(Subscription.id == subscription.id)
		.first()
	)
	return _subscription_to_out(subscription)
