from datetime import datetime, timedelta
from secrets import token_urlsafe
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.db.mongodb import get_database
from app.modules.auth.db import (
    create_social_user,
    create_user,
    get_user_by_email,
    set_password_reset_token,
    update_password_and_clear_reset,
)
from app.modules.auth.models import User, UserCreate
from app.modules.workforce.db import get_worker_by_email

router = APIRouter()


# ============================================================
# REQUEST / RESPONSE MODELS
# ============================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User
    worker_id: Optional[str] = None


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


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetResponse(BaseModel):
    message: str
    reset_token: str | None = None


class PasswordResetConfirmRequest(BaseModel):
    email: EmailStr
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ============================================================
# HELPERS
# ============================================================

def serialize_user(user: dict) -> User:
    """
    Convert MongoDB user document into the Pydantic User model.
    """
    user_data = {**user}

    if "_id" in user_data:
        user_data["_id"] = str(user_data["_id"])

    return User(**user_data)


def normalize_role(role: str | None) -> str:
    """
    Normalize roles so values like:
    Vendor, VENDOR, vendor -> vendor
    Project Manager -> project manager
    """
    return (role or "").strip().lower().replace("_", " ")


async def get_active_vendor(db, vendor_id: str):
    """
    Find an existing active Vendor document.

    Vendor login accounts must always point to an existing Vendor.
    """
    try:
        object_id = ObjectId(vendor_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid vendor_id",
        )

    vendor = await db.vendors.find_one({"_id": object_id})

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Linked vendor record does not exist",
        )

    if normalize_role(vendor.get("status")) != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Linked vendor record is not active",
        )

    return vendor


# ============================================================
# NORMAL USER REGISTRATION
# ============================================================

@router.post("/register", response_model=RegisterResponse)
async def register(
    request: RegisterRequest,
    db=Depends(get_database),
):
    """
    Public registration for normal users.

    IMPORTANT:
    Vendors are NOT allowed to self-register.

    A Vendor account can only be created by an Administrator
    through /auth/vendor-user.
    """

    requested_role = normalize_role(request.role)

    # --------------------------------------------------------
    # IMPORTANT SECURITY RULE
    # --------------------------------------------------------
    # Vendor registration is NEVER allowed through the public
    # registration endpoint.
    if requested_role == "vendor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Vendor self-registration is not allowed. "
                "An administrator must create the vendor account."
            ),
        )

    # --------------------------------------------------------
    # Check duplicate email
    # --------------------------------------------------------
    existing_user = await get_user_by_email(db, request.email)

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # --------------------------------------------------------
    # Create normal user
    # --------------------------------------------------------
    user = await create_user(db, request)

    return RegisterResponse(
        message="User registered successfully",
        user=serialize_user(user),
    )


# ============================================================
# ADMIN CREATES VENDOR LOGIN
# ============================================================

@router.post("/vendor-user", response_model=RegisterResponse)
async def create_vendor_user(
    request: RegisterRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Administrator-only endpoint.

    Workflow:

        1. Admin creates Vendor record.
        2. Admin creates Vendor login using this endpoint.
        3. Vendor user is linked to vendor_id.
        4. Vendor cannot create their own account.
        5. Vendor can then log in through /auth/login.
    """

    # --------------------------------------------------------
    # ONLY ADMINISTRATOR
    # --------------------------------------------------------
    current_role = normalize_role(current_user.get("role"))

    if current_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an administrator can create vendor accounts",
        )

    # --------------------------------------------------------
    # Role MUST be vendor
    # --------------------------------------------------------
    requested_role = normalize_role(request.role)

    if requested_role != "vendor":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be vendor when creating a vendor account",
        )

    # --------------------------------------------------------
    # vendor_id is mandatory
    # --------------------------------------------------------
    if not request.vendor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="vendor_id is required",
        )

    # --------------------------------------------------------
    # Check duplicate email
    # --------------------------------------------------------
    existing_user = await get_user_by_email(db, request.email)

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # --------------------------------------------------------
    # Verify vendor exists and is active
    # --------------------------------------------------------
    vendor = await get_active_vendor(db, request.vendor_id)

    # --------------------------------------------------------
    # Prevent multiple login accounts for the same vendor
    # --------------------------------------------------------
    existing_vendor_user = await db.users.find_one(
        {
            "vendor_id": request.vendor_id,
            "role": {"$in": ["vendor", "VENDOR"]},
        }
    )

    if existing_vendor_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A login account already exists for this vendor",
        )

    # --------------------------------------------------------
    # Create vendor user
    # --------------------------------------------------------
    user = await create_user(db, request)

    return RegisterResponse(
        message=f"Vendor login created successfully for {vendor.get('vendor_name', 'vendor')}",
        user=serialize_user(user),
    )


# ============================================================
# LOGIN
# ============================================================

@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db=Depends(get_database),
):
    """
    Normal login endpoint for every authorized user.

    Vendor login is allowed ONLY when:
        - user exists
        - password is correct
        - user role is vendor
        - vendor_id exists
        - linked vendor exists
        - linked vendor is active
        - user account is active
    """

    # --------------------------------------------------------
    # Find user
    # --------------------------------------------------------
    user = await get_user_by_email(db, request.email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # --------------------------------------------------------
    # Verify account status
    # --------------------------------------------------------
    user_status = normalize_role(user.get("status"))

    if user_status in {"suspended", "inactive", "disabled"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive or suspended",
        )

    # --------------------------------------------------------
    # Verify password
    # --------------------------------------------------------
    password_hash = user.get("password_hash")

    if not password_hash or not verify_password(
        request.password,
        password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # --------------------------------------------------------
    # VENDOR-SPECIFIC SECURITY CHECK
    # --------------------------------------------------------
    user_role = normalize_role(user.get("role"))

    if user_role == "vendor":
        vendor_id = user.get("vendor_id")

        # Vendor user MUST be linked to a vendor.
        if not vendor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vendor account is not linked to a vendor record",
            )

        # Vendor record MUST exist and be active.
        await get_active_vendor(db, str(vendor_id))

    # --------------------------------------------------------
    # WORKER-SPECIFIC LINKING
    # --------------------------------------------------------
    # Unlike vendor accounts, a worker login is NOT blocked if no
    # matching Worker record exists yet — the account can still log
    # in, worker_id just stays None until an admin creates their
    # Worker record with a matching email.
    worker_id = None

    if user_role == "worker":
        worker = await get_worker_by_email(db, user["email"])

        if worker:
            worker_id = str(worker["_id"])

    # --------------------------------------------------------
    # Create JWT
    # --------------------------------------------------------
    token = create_access_token(
        subject=str(user["_id"]),
        extra_claims={
            "email": user["email"],
            "role": user["role"],
            "vendor_id": user.get("vendor_id"),
            "worker_id": worker_id,
        },
    )

    return LoginResponse(
        access_token=token,
        user=serialize_user(user),
        worker_id=worker_id,
    )


# ============================================================
# SOCIAL LOGIN
# ============================================================

@router.post("/social-login", response_model=LoginResponse)
async def social_login(
    request: SocialLoginRequest,
    db=Depends(get_database),
):
    """
    Demo social login for Google/Microsoft.

    Vendor accounts are not created through social login.
    """

    provider = request.provider.lower().strip()

    if provider not in {"google", "microsoft"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported social login provider",
        )

    requested_role = normalize_role(request.role)

    # Vendors must be created by Admin.
    if requested_role == "vendor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Vendor social registration is not allowed. "
                "An administrator must create the vendor account."
            ),
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

    # --------------------------------------------------------
    # WORKER-SPECIFIC LINKING (same as /login)
    # --------------------------------------------------------
    worker_id = None

    if normalize_role(user.get("role")) == "worker":
        worker = await get_worker_by_email(db, user["email"])

        if worker:
            worker_id = str(worker["_id"])

    # --------------------------------------------------------
    # Create JWT
    # --------------------------------------------------------
    token = create_access_token(
        subject=str(user["_id"]),
        extra_claims={
            "email": user["email"],
            "role": user["role"],
            "vendor_id": user.get("vendor_id"),
            "worker_id": worker_id,
        },
    )

    return LoginResponse(
        access_token=token,
        user=serialize_user(user),
        worker_id=worker_id,
    )


# ============================================================
# PASSWORD RESET - REQUEST
# ============================================================

@router.post(
    "/password-reset/request",
    response_model=PasswordResetResponse,
)
async def request_password_reset(
    request: PasswordResetRequest,
    db=Depends(get_database),
):
    """
    Create a password reset token.

    For local/demo use the token is returned in the response.
    In production it should be emailed to the user.
    """

    user = await get_user_by_email(db, request.email)

    generic_message = (
        "If an account exists for that email, "
        "a reset link has been generated."
    )

    if not user:
        return PasswordResetResponse(
            message=generic_message
        )

    reset_token = token_urlsafe(32)

    await set_password_reset_token(
        db,
        request.email,
        hash_password(reset_token),
        datetime.utcnow() + timedelta(minutes=30),
    )

    return PasswordResetResponse(
        message=generic_message,
        reset_token=reset_token,
    )


# ============================================================
# PASSWORD RESET - CONFIRM
# ============================================================

@router.post("/password-reset/confirm")
async def confirm_password_reset(
    request: PasswordResetConfirmRequest,
    db=Depends(get_database),
):
    """
    Reset password using a valid reset token.
    """

    user = await get_user_by_email(
        db,
        request.email,
    )

    if not user or not user.get("password_reset_token_hash"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    expires_at = user.get("password_reset_expires_at")

    if expires_at and expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    if not verify_password(
        request.token,
        user["password_reset_token_hash"],
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    await update_password_and_clear_reset(
        db,
        str(user["_id"]),
        hash_password(request.new_password),
    )

    return {
        "message": "Password reset successfully"
    }


# ============================================================
# CURRENT USER
# ============================================================

@router.get("/me", response_model=User)
async def get_profile(
    current_user=Depends(get_current_user),
):
    """
    Return currently authenticated user's profile.
    """
    return serialize_user(current_user)


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Change password for the currently authenticated user.
    """
    if len(request.new_password.strip()) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long",
        )

    password_hash = current_user.get("password_hash")
    if not password_hash or not verify_password(request.current_password, password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password",
        )

    await update_password_and_clear_reset(
        db,
        str(current_user["_id"]),
        hash_password(request.new_password),
    )

    return {"message": "Password changed successfully"}


@router.get("/managers", response_model=list[User])
async def list_managers_endpoint(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Return all registered users who have a manager or admin role,
    for project manager assignment dropdowns.
    """
    cursor = db.users.find({
        "role": {
            "$in": [
                "manager",
                "Project Manager",
                "project_manager",
                "admin",
                "Administrator",
                "superadmin",
            ]
        }
    })
    users = await cursor.to_list(200)
    return [serialize_user(u) for u in users]