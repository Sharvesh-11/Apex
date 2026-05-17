from urllib.parse import urlencode
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.models.user import User, UserRole
from app.models.member import Member
from app.core.security import create_access_token
from app.schemas.users import TokenResponse


router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


@router.get("/google/url")
def google_auth_url():
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
    }
    url = GOOGLE_AUTH_URL + "?" + urlencode(params)
    return {"url": url}


@router.post("/google/callback", response_model=TokenResponse)
def google_callback(data: dict, db: Session = Depends(get_db)):
    code = data.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")

    # Exchange code for tokens
    token_payload = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "code": code,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    try:
        token_resp = httpx.post(GOOGLE_TOKEN_URL, data=token_payload, timeout=10.0)
        token_resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {str(e)}")

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="No access token returned from Google")

    # Fetch user info
    try:
        user_resp = httpx.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}, timeout=10.0)
        user_resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch user info: {str(e)}")

    info = user_resp.json()
    email = info.get("email")
    name = info.get("name")
    picture = info.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Google did not return an email")

    # Find or create user
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(id=uuid.uuid4(), email=email, hashed_password="", role=UserRole.gym_member, is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)

        member = Member(id=uuid.uuid4(), user_id=user.id, full_name=name or email.split("@")[0], profile_photo_url=picture)
        db.add(member)
        db.commit()

    # Create JWT
    token_payload = {"sub": str(user.id), "role": user.role.value}
    access_jwt = create_access_token(token_payload)

    return TokenResponse(access_token=access_jwt, token_type="bearer", role=user.role.value, user_id=str(user.id))
