from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import Optional, Literal
from uuid import UUID
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.core.dependencies import require_role
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.users import TokenResponse, UserCreate, UserLogin, UserOut
from app.services.auth_service import login_user, register_user

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)) -> UserOut:
    """Register a new user and optionally create a member profile."""
    user = register_user(db, user_data)
    return UserOut.model_validate(user)


@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    """Authenticate user and return JWT token."""
    return login_user(db, login_data)


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserOut:
    """Get the current logged-in user with full_name populated."""
    # Fetch user with member relation if exists
    user = db.query(User).options(joinedload(User.member)).filter(User.id == current_user.id).first()
    
    # Determine full_name: from member profile or email prefix
    full_name = None
    if user and user.member:
        full_name = user.member.full_name
    else:
        # Fallback: use email prefix (part before @)
        full_name = user.email.split("@")[0] if user else None
    
    out = UserOut.model_validate(user)
    out.full_name = full_name
    return out


@router.get("/users", response_model=list[UserOut])
def list_users(
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("gym_owner", "admin")),
) -> list[UserOut]:
    """Fetch all users, optionally filtering by role. Protected: admin only."""
    query = db.query(User).options(joinedload(User.member))
    if role is not None:
        try:
            role_enum = UserRole(role)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
        query = query.filter(User.role == role_enum)
    users = query.order_by(User.email.asc()).all()
    out_list: list[UserOut] = []
    for u in users:
        out = UserOut.model_validate(u)
        # prefer member.full_name when available
        if getattr(u, "member", None) and getattr(u.member, "full_name", None):
            out.full_name = u.member.full_name
        else:
            out.full_name = u.email.split("@")[0] if u.email else None
        out_list.append(out)
    return out_list


@router.put("/users/{user_id}/toggle-active", response_model=UserOut)
def toggle_user_active(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gym_owner")),
) -> UserOut:
    """Toggle a user's `is_active` flag. Protected: admin only."""
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


class SetRoleRequest(BaseModel):
    role: Literal["gym_owner", "gym_member", "admin"]


@router.put("/users/{user_id}/set-role", response_model=UserOut)
def set_user_role(
    user_id: UUID,
    data: SetRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role( "gym_owner")),
) -> UserOut:
    """Set a user's role. Protected: admin only."""
    try:
        role_enum = UserRole(data.role)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.role = role_enum
    db.commit()
    db.refresh(user)

    user = db.query(User).options(joinedload(User.member)).filter(User.id == user.id).first()
    return UserOut.model_validate(user)
