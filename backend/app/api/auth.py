from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.core.security import verify_password, get_password_hash, create_access_token
from backend.app.db.session import get_db
from backend.app.models.user import User, DriverProfile, UserRole
from backend.app.schemas.user import UserCreate, UserLogin, UserOut, TokenResponse, DriverProfileOut
from backend.app.api.deps import get_current_user, log_audit

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """Register a new user (driver, caretaker, or officer)."""
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists."
        )

    # Validate role
    role = user_in.role.lower()
    valid_roles = [r.value for r in UserRole]
    if role not in valid_roles:
        role = UserRole.DRIVER.value

    # Create user
    user = User(
        email=user_in.email,
        phone=user_in.phone,
        name=user_in.name,
        hashed_password=get_password_hash(user_in.password),
        role=role,
        is_active=True
    )
    db.add(user)
    db.flush()

    # If driver, create driver profile automatically
    if role == UserRole.DRIVER.value:
        profile = DriverProfile(
            user_id=user.id,
            current_safety_score=95.0,
            total_distance_km=0.0,
            total_trips=0
        )
        db.add(profile)

    db.commit()
    db.refresh(user)

    log_audit(db, user.id, "USER_REGISTERED", "user", str(user.id), {"role": role, "email": user.email})

    access_token = create_access_token(user.id)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )


@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """Standard JSON login endpoint returning access token."""
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account is deactivated.")

    log_audit(db, user.id, "USER_LOGIN", "user", str(user.id), {"email": user.email})

    access_token = create_access_token(user.id)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )


@router.post("/token", response_model=TokenResponse)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 password form compatible endpoint for Swagger UI."""
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(user.id)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )


@router.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Fetch profile of currently authenticated user."""
    return UserOut.model_validate(current_user)


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Log user logout in audit trail."""
    log_audit(db, current_user.id, "USER_LOGOUT", "user", str(current_user.id))
    return {"message": "Successfully logged out"}
