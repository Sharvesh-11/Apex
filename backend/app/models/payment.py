import uuid
from enum import Enum as PyEnum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class PaymentMethod(str, PyEnum):
	razorpay = "razorpay"
	cash = "cash"


class PaymentStatus(str, PyEnum):
	pending = "pending"
	completed = "completed"
	failed = "failed"


class Payment(Base):
	__tablename__ = "payments"

	id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	member_id = Column(UUID(as_uuid=True), ForeignKey("members.id"), nullable=False)
	subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=False)
	amount = Column(Numeric(10, 2), nullable=False)
	payment_method = Column(Enum(PaymentMethod, name="payment_method"), nullable=False)
	payment_status = Column(Enum(PaymentStatus, name="payment_status"), nullable=False)
	razorpay_order_id = Column(String, nullable=True)
	razorpay_payment_id = Column(String, nullable=True)
	notes = Column(String, nullable=True)
	paid_at = Column(DateTime(timezone=True), nullable=True)
	created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

	member = relationship("Member")
