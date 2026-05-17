import uuid
from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Column, Date, ForeignKey, String, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.database import Base


class Member(Base):
	__tablename__ = "members"

	id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
	full_name = Column(String, nullable=False)
	phone = Column(String, nullable=True)
	profile_photo_url = Column(String, nullable=True)
	pin = Column(String, nullable=True)

	current_streak: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
	longest_streak: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
	last_checkin_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
	joined_at = Column(Date, nullable=False, default=date.today)
	is_active = Column(Boolean, nullable=False, default=True)

	user = relationship("User", back_populates="member")
