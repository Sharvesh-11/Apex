from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    billing_cycle: str


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    is_active: Optional[bool] = None


class PlanOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    price: float
    billing_cycle: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
