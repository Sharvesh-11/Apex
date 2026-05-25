import uuid
from enum import Enum as PyEnum

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class SubscriptionStatus(str, PyEnum):
	pending = "pending"
	active = "active"
	expired = "expired"
	cancelled = "cancelled"


class Subscription(Base):
	__tablename__ = "subscriptions"

	id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	member_id = Column(UUID(as_uuid=True), ForeignKey("members.id"), nullable=False)
	member_name = Column(String, nullable=True)
	member_email = Column(String, nullable=True)
	plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False)
	start_date = Column(Date, nullable=False)
	end_date = Column(Date, nullable=False)
	status = Column(Enum(SubscriptionStatus, name="subscription_status"), nullable=False)
	created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

	member = relationship("Member")
	plan = relationship("Plan")
