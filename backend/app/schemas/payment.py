from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CashPaymentCreate(BaseModel):
    member_id: UUID
    subscription_id: UUID
    amount: float
    notes: Optional[str] = None


class RazorpayOrderCreate(BaseModel):
    member_id: UUID
    subscription_id: UUID
    amount: float


class RazorpayVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    subscription_id: UUID


class PaymentOut(BaseModel):
    id: UUID
    member_id: UUID
    member_name: Optional[str] = None
    subscription_id: UUID
    amount: float
    payment_method: str
    payment_status: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    notes: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
