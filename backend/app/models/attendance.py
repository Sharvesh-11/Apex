import uuid
from enum import Enum as PyEnum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AttendanceMethod(str, PyEnum):
	qr = "qr"
	pin = "pin"


class AttendanceLog(Base):
	__tablename__ = "attendance_logs"

	id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	member_id = Column(UUID(as_uuid=True), ForeignKey("members.id"), nullable=False)
	checked_in_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
	method = Column(Enum(AttendanceMethod, name="attendance_method"), nullable=False)

	member = relationship("Member")
