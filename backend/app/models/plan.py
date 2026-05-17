import uuid
from enum import Enum as PyEnum

from sqlalchemy import Boolean, Column, DateTime, Enum, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class BillingCycle(str, PyEnum):
	monthly = "monthly"
	quarterly = "quarterly"
	annual = "annual"


class Plan(Base):
	__tablename__ = "plans"

	id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	name = Column(String, nullable=False)
	description = Column(String, nullable=True)
	price = Column(Numeric(10, 2), nullable=False)
	billing_cycle = Column(Enum(BillingCycle, name="billing_cycle"), nullable=False)
	is_active = Column(Boolean, nullable=False, default=True)
	created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
