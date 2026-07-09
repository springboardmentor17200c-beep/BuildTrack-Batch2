from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.db.mongodb import get_database
from app.modules.auth.db import create_user, get_user_by_email
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
        user=User(**user, id=str(user["_id"])),
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
    if not verify_password(request.password, user["password_hash"]):
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
        user=User(**user, id=str(user["_id"])),
    )


@router.get("/me", response_model=User)
async def get_profile(current_user=Depends(get_current_user)):
    """Get current user profile"""
    return User(**current_user, id=str(current_user["_id"]))
