from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.db.mongodb import get_database
from app.modules.auth.db import create_social_user, create_user, get_user_by_email
from app.modules.auth.models import User, UserCreate

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User


class RegisterRequest(UserCreate):
    pass


class RegisterResponse(BaseModel):
    message: str
    user: User


class SocialLoginRequest(BaseModel):
    provider: str
    email: EmailStr
    full_name: str
    role: str = "worker"
    status: str = "active"


def serialize_user(user: dict) -> User:
    user_data = {**user, "_id": str(user["_id"])}
    return User(**user_data)


@router.post("/register", response_model=RegisterResponse)
async def register(request: RegisterRequest, db=Depends(get_database)):
    """Register a new user"""
    # Check if user already exists
    existing_user = await get_user_by_email(db, request.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create user
    user = await create_user(db, request)
    
    return RegisterResponse(
        message="User registered successfully",
        user=serialize_user(user),
    )


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db=Depends(get_database)):
    """Login and get JWT token"""
    # Find user by email
    user = await get_user_by_email(db, request.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Verify password
    if not user.get("password_hash") or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Create token with extra claims
    token = create_access_token(
        subject=str(user["_id"]),
        extra_claims={"email": user["email"], "role": user["role"]},
    )

    return LoginResponse(
        access_token=token,
        user=serialize_user(user),
    )


@router.post("/social-login", response_model=LoginResponse)
async def social_login(request: SocialLoginRequest, db=Depends(get_database)):
    """Demo social login for Google/Microsoft."""
    provider = request.provider.lower().strip()
    if provider not in {"google", "microsoft"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported social login provider",
        )

    user = await get_user_by_email(db, request.email)
    if not user:
        user = await create_social_user(
            db,
            email=request.email,
            full_name=request.full_name,
            role=request.role,
            provider=provider,
            status=request.status,
        )

    token = create_access_token(
        subject=str(user["_id"]),
        extra_claims={"email": user["email"], "role": user["role"]},
    )

    return LoginResponse(
        access_token=token,
        user=serialize_user(user),
    )


@router.get("/me", response_model=User)
async def get_profile(current_user=Depends(get_current_user)):
    """Get current user profile"""
    return serialize_user(current_user)
