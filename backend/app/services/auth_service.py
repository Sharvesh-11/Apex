import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.member import Member
from app.models.user import User, UserRole
from app.schemas.users import TokenResponse, UserCreate, UserLogin


def register_user(db: Session, data: UserCreate) -> User:
    """Register a new user and optionally create a member profile."""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Hash password
    hashed_password = hash_password(data.password)

    # Parse role
    try:
        role = UserRole(data.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role",
        )

    # Create user
    new_user = User(
        id=uuid.uuid4(),
        email=data.email,
        hashed_password=hashed_password,
        role=role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # If role is gym_member, create member profile
    if role == UserRole.gym_member:
        new_member = Member(
            id=uuid.uuid4(),
            user_id=new_user.id,
            full_name=data.full_name,
            phone=data.phone,
            is_active=True,
        )
        db.add(new_member)
        db.commit()

    return new_user


def login_user(db: Session, data: UserLogin) -> TokenResponse:
    """Authenticate user and return JWT token."""
    # Fetch user by email
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Verify password
    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # Create JWT token
    token_payload = {"sub": str(user.id), "role": user.role.value}
    access_token = create_access_token(token_payload)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role.value,
        user_id=str(user.id),
    )
