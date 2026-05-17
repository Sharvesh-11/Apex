from datetime import datetime, timezone

import razorpay
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.schemas.payment import CashPaymentCreate, RazorpayVerify


def _get_razorpay_client() -> razorpay.Client:
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


def create_razorpay_order(amount: float) -> dict:
    """Create a Razorpay order in paise."""
    client = _get_razorpay_client()
    order = client.order.create(
        {
            "amount": int(amount * 100),
            "currency": "INR",
        }
    )
    return order


def verify_razorpay_signature(data: RazorpayVerify) -> bool:
    """Verify a Razorpay payment signature."""
    client = _get_razorpay_client()
    payload = {
        "razorpay_order_id": data.razorpay_order_id,
        "razorpay_payment_id": data.razorpay_payment_id,
        "razorpay_signature": data.razorpay_signature,
    }

    try:
        return client.utility.verify_payment_signature(payload)
    except Exception:
        return False


def record_cash_payment(db: Session, data: CashPaymentCreate) -> Payment:
    """Record a completed cash payment."""
    payment = Payment(
        member_id=data.member_id,
        subscription_id=data.subscription_id,
        amount=data.amount,
        payment_method=PaymentMethod.cash,
        payment_status=PaymentStatus.completed,
        notes=data.notes,
        paid_at=datetime.now(timezone.utc),
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment
