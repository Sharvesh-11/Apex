from datetime import date, datetime, time
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CheckInQrRequest(BaseModel):
	qr_data: str


class CheckInPinRequest(BaseModel):
	pin: str


class CheckInResponse(BaseModel):
	message: str
	member_name: str
	time: datetime


class AttendanceOut(BaseModel):
	id: UUID
	member_id: UUID
	checked_in_at: datetime
	method: str

	model_config = ConfigDict(from_attributes=True)


class AttendanceResponse(BaseModel):
	id: UUID
	member_id: UUID
	date: date
	time: time
	method: str
	created_at: Optional[datetime] = None

	model_config = ConfigDict(from_attributes=True)


class AttendanceFilter(BaseModel):
	member_id: Optional[UUID] = None
	date: Optional[date] = None
