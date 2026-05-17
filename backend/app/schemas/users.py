from typing import Literal, Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict


class UserCreate(BaseModel):
    """Schema for creating a new user."""
    email: EmailStr
    password: str
    role: Literal["admin", "gym_owner", "gym_member"]
    full_name: str
    phone: Optional[str] = None


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str


class UserOut(BaseModel):
    """Schema for returning user data."""
    id: UUID
    email: str
    role: str
    is_active: bool
    full_name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
