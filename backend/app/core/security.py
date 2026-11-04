import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Union
import bcrypt
from jose import jwt, JWTError
from backend.app.core.config import settings


def get_password_hash(password: str) -> str:
    """Generate secure password hash using native bcrypt."""
    try:
        salt = bcrypt.gensalt(rounds=12)
        pwd_bytes = password.encode('utf-8')
        return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')
    except Exception:
        # Fallback to salted SHA256 if native bindings have an issue
        salt = os.urandom(16).hex()
        h = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
        return f"sha256:{salt}:{h}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash with bcrypt or SHA256 fallback."""
    if hashed_password.startswith("sha256:"):
        parts = hashed_password.split(":")
        if len(parts) == 3:
            _, salt, h = parts
            check = hashlib.sha256((salt + plain_password).encode("utf-8")).hexdigest()
            return check == h
        return False
    try:
        pwd_bytes = plain_password.encode('utf-8')
        hash_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create signed JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "iat": datetime.now(timezone.utc)
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[str]:
    """Decode JWT and return subject (user_id)."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        return user_id
    except JWTError:
        return None
