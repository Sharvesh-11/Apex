from datetime import date, datetime
from uuid import UUID
from typing import Optional, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.plan import PlanOut


class SubscriptionCreate(BaseModel):
    member_id: UUID
    plan_id: UUID
    start_date: date


class AdminSubscriptionCreate(BaseModel):
    member_id: UUID
    plan_id: UUID
    start_date: date = Field(default_factory=date.today)
    payment_method: Literal["cash", "razorpay"]
    notes: Optional[str] = None


class SubscriptionOut(BaseModel):
    id: UUID
    member_id: UUID
    member_name: Optional[str] = None
    member_email: Optional[str] = None
    plan_id: UUID
    start_date: date
    end_date: date
    status: str
    created_at: datetime
    plan: PlanOut

    model_config = ConfigDict(from_attributes=True)
