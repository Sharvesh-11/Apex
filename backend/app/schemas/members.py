from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class MemberCreate(BaseModel):
	full_name: str
	phone: Optional[str] = None
	email: EmailStr
	password: str


class MemberUpdate(BaseModel):
	full_name: Optional[str] = None
	phone: Optional[str] = None
	is_active: Optional[bool] = None


class MemberOut(BaseModel):
	id: UUID
	user_id: UUID
	full_name: str
	phone: Optional[str] = None
	profile_photo_url: Optional[str] = None
	pin: Optional[str] = None
	current_streak: int = 0
	longest_streak: int = 0
	last_checkin_date: Optional[date] = None
	joined_at: date
	is_active: bool
	email: str
	role: Optional[str] = None

	model_config = ConfigDict(from_attributes=True)
