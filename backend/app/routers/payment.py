from datetime import datetime, timezone, date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.member import Member
from app.models.plan import Plan, BillingCycle
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.user import User
from app.schemas.payment import (
	CashPaymentCreate,
	PaymentOut,
	RazorpayOrderCreate,
	RazorpayVerify,
)
from app.schemas.subscription import AdminSubscriptionCreate, SubscriptionOut
from app.services.payment_service import (
	create_razorpay_order,
	record_cash_payment,
	verify_razorpay_signature,
)


class RazorpayInitiateRequest(BaseModel):
    plan_id: UUID



router = APIRouter()


def _payment_to_out(payment: Payment, db: Session = None) -> PaymentOut:
    member_name = None
    if db is not None:
        member = db.query(Member).filter(
            Member.id == payment.member_id
        ).first()
        if member:
            member_name = member.full_name
    
    return PaymentOut(
        id=payment.id,
        member_id=payment.member_id,
        member_name=member_name,
        subscription_id=payment.subscription_id,
        amount=payment.amount,
        payment_method=getattr(payment.payment_method, 'value', payment.payment_method),
        payment_status=getattr(payment.payment_status, 'value', payment.payment_status),
        razorpay_order_id=payment.razorpay_order_id,
        razorpay_payment_id=payment.razorpay_payment_id,
        notes=payment.notes,
        paid_at=payment.paid_at,
        created_at=payment.created_at,
    )

def _subscription_to_out(subscription: Subscription) -> SubscriptionOut:
    return SubscriptionOut.model_validate(subscription)


def _current_role(user: User) -> str:
	return getattr(user.role, "value", user.role)


@router.post("/cash", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_cash_payment(
	data: CashPaymentCreate,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> PaymentOut:
	payment = record_cash_payment(db, data)
	return _payment_to_out(payment, db)


@router.post("/razorpay/order")
def create_razorpay_payment_order(
	data: RazorpayOrderCreate,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_member")),
) -> dict:
	member = db.query(Member).filter(Member.id == data.member_id).first()
	if member is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

	current_role = _current_role(current_user)
	if current_role == "gym_member" and member.user_id != current_user.id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

	order = create_razorpay_order(data.amount)
	payment = Payment(
		member_id=data.member_id,
		subscription_id=data.subscription_id,
		amount=data.amount,
		payment_method=PaymentMethod.razorpay,
		payment_status=PaymentStatus.pending,
		razorpay_order_id=order.get("id"),
	)
	db.add(payment)
	db.commit()
	db.refresh(payment)

	return {"order": order, "payment_id": str(payment.id)}


@router.post("/razorpay/verify", response_model=PaymentOut)
def verify_razorpay_payment(
	data: RazorpayVerify,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_member")),
) -> PaymentOut:
	is_valid = verify_razorpay_signature(data)
	if not is_valid:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment verification failed")

	payment = (
		db.query(Payment)
		.filter(
			Payment.razorpay_order_id == data.razorpay_order_id,
			Payment.subscription_id == data.subscription_id,
		)
		.first()
	)
	if payment is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

	member = db.query(Member).filter(Member.id == payment.member_id).first()
	if member is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

	if member.user_id != current_user.id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

	payment.razorpay_payment_id = data.razorpay_payment_id
	payment.payment_status = PaymentStatus.completed
	payment.paid_at = datetime.now(timezone.utc)

	# Update linked subscription from pending -> active
	subscription = db.query(Subscription).filter(Subscription.id == payment.subscription_id).first()
	if subscription is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")



	# Only change if currently pending
	if subscription.status == SubscriptionStatus.pending:
		subscription.status = SubscriptionStatus.active

	db.commit()
	db.refresh(payment)
	return _payment_to_out(payment, db)


@router.get("/member/{member_id}", response_model=list[PaymentOut])
def list_member_payments(
	member_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_user),
) -> list[PaymentOut]:
	member = db.query(Member).filter(Member.id == member_id).first()
	if member is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

	current_role = _current_role(current_user)
	if current_role == "gym_member" and member.user_id != current_user.id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

	payments = (
		db.query(Payment)
		.filter(Payment.member_id == member_id, Payment.payment_status == PaymentStatus.completed)
		.order_by(Payment.created_at.desc())
		.all()
	)
	return [_payment_to_out(payment, db) for payment in payments]


@router.get("/", response_model=list[PaymentOut])
def list_all_payments(
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> list[PaymentOut]:
	payments = db.query(Payment).filter(Payment.payment_status == PaymentStatus.completed).order_by(Payment.created_at.desc()).all()
	return [_payment_to_out(payment, db) for payment in payments]


@router.post("/razorpay/initiate", include_in_schema=True)
def initiate_razorpay_for_plan(
	data: RazorpayInitiateRequest,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_member")),
) -> dict:
	# Fetch member for current user
	member = db.query(Member).filter(Member.user_id == current_user.id).first()
	if member is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

	# Fetch plan
	plan = db.query(Plan).filter(Plan.id == data.plan_id).first()
	if plan is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

	# Check existing active subscription
	existing = (
		db.query(Subscription)
		.filter(Subscription.member_id == member.id, Subscription.status == SubscriptionStatus.active)
		.first()
	)
	if existing is not None:
		return {
			"already_active": True,
			"subscription_id": str(existing.id),
			"end_date": str(existing.end_date),
			"message": "You already have an active subscription",
		}

	# Calculate end_date
	cycle_value = getattr(plan.billing_cycle, "value", plan.billing_cycle)
	if cycle_value == "monthly":
		days = 30
	elif cycle_value == "quarterly":
		days = 90
	elif cycle_value == "annual":
		days = 365
	else:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid billing cycle")


	start = date.today()
	end = start + timedelta(days=days)

	# Create subscription in pending state until payment verification completes
	subscription = Subscription(
		member_id=member.id,
		plan_id=plan.id,
		start_date=start,
		end_date=end,
		status=SubscriptionStatus.pending,
	)
	db.add(subscription)
	db.commit()
	db.refresh(subscription)

	# Create razorpay order and pending payment
	amount = float(plan.price)
	order = create_razorpay_order(amount)

	payment = Payment(
		member_id=member.id,
		subscription_id=subscription.id,
		amount=amount,
		payment_method=PaymentMethod.razorpay,
		payment_status=PaymentStatus.pending,
		razorpay_order_id=order.get("id"),
	)
	db.add(payment)
	db.commit()
	db.refresh(payment)

	return {
		"razorpay_order_id": order.get("id"),
		"amount": amount,
		"subscription_id": str(subscription.id),
		"payment_id": str(payment.id),
		"plan_name": plan.name,
	}



@router.post(
	"/admin/subscription",
	response_model=SubscriptionOut,
	status_code=status.HTTP_201_CREATED,
)
def admin_create_subscription(
	data: AdminSubscriptionCreate,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("admin")),
) -> SubscriptionOut:
	member = db.query(Member).filter(Member.id == data.member_id).first()
	if member is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

	# Check existing active subscription
	existing = (
		db.query(Subscription)
		.filter(Subscription.member_id == member.id, Subscription.status == SubscriptionStatus.active)
		.first()
	)
	if existing is not None:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Member already has an active subscription")

	plan = db.query(Plan).filter(Plan.id == data.plan_id).first()
	if plan is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

	cycle_value = getattr(plan.billing_cycle, "value", plan.billing_cycle)
	if cycle_value == "monthly":
		days = 30
	elif cycle_value == "quarterly":
		days = 90
	elif cycle_value == "annual":
		days = 365
	else:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid billing cycle")

	start = data.start_date or date.today()
	end = start + timedelta(days=days)

	subscription = Subscription(
		member_id=member.id,
		plan_id=plan.id,
		start_date=start,
		end_date=end,
		status=SubscriptionStatus.active,
	)
	db.add(subscription)
	db.commit()
	db.refresh(subscription)

	payment = Payment(
		member_id=member.id,
		subscription_id=subscription.id,
		amount=float(plan.price),
		payment_method=PaymentMethod(data.payment_method),
		payment_status=PaymentStatus.completed,
		paid_at=datetime.now(timezone.utc),
		notes=data.notes,
	)
	db.add(payment)
	db.commit()
	db.refresh(payment)

	return _subscription_to_out(subscription)


@router.delete("/admin/subscription/{subscription_id}")
def admin_cancel_subscription(
	subscription_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("admin")),
):
	subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
	if subscription is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

	if subscription.status in (SubscriptionStatus.cancelled, SubscriptionStatus.expired):
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Subscription is not active")

	subscription.status = SubscriptionStatus.cancelled
	db.commit()
	return {"message": "Subscription cancelled successfully"}


@router.delete("/{payment_id}")
def delete_payment(
	payment_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
):
	payment = db.query(Payment).filter(Payment.id == payment_id).first()
	if payment is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

	db.delete(payment)
	db.commit()
	return {"message": "Payment log deleted"}
