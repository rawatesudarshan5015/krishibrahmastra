import secrets
import redis
from datetime import datetime, timedelta
import bcrypt
from jose import jwt, JWTError
from app.core.config import settings
from app.db.client import prisma

redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "access"},
        settings.SECRET_KEY, algorithm="HS256"
    )

def decode_access_token(token: str) -> dict:
    """Raises JWTError on invalid/expired token."""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    # Check Redis blacklist
    if redis_client.get(f"blacklist:{token}"):
        raise JWTError("Token has been revoked")
    return payload

async def create_refresh_token(user_id: str) -> str:
    """Stores refresh token in DB for rotation + revocation."""
    token = secrets.token_urlsafe(64)
    expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    await prisma.refreshtoken.create(data={
        "token": token, "userId": user_id, "expiresAt": expires_at
    })
    return token

async def rotate_refresh_token(old_token: str) -> tuple[str, str]:
    """Revoke old token, issue new access + refresh pair (token rotation)."""
    record = await prisma.refreshtoken.find_unique(where={"token": old_token})
    if not record or record.revokedAt or record.expiresAt < datetime.utcnow():
        raise ValueError("Invalid or expired refresh token")
    # Revoke old
    await prisma.refreshtoken.update(
        where={"id": record.id},
        data={"revokedAt": datetime.utcnow()}
    )
    # Issue new pair
    access_token = create_access_token(record.userId)
    new_refresh = await create_refresh_token(record.userId)
    return access_token, new_refresh

async def revoke_all_user_tokens(user_id: str):
    """Call on logout — revokes all refresh tokens for the user."""
    await prisma.refreshtoken.update_many(
        where={"userId": user_id, "revokedAt": None},
        data={"revokedAt": datetime.utcnow()}
    )
