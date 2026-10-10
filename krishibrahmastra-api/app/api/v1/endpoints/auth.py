from fastapi import APIRouter, HTTPException, Response, Cookie, Depends, Request
from app.core.limiter import limiter
from app.services.auth_service import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, rotate_refresh_token, revoke_all_user_tokens,
)
from app.api.deps import get_current_user
from app.db.client import prisma
from pydantic import BaseModel

router = APIRouter()


class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


def set_refresh_cookie(response: Response, token: str):
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=30 * 24 * 3600,
        path="/api/v1/auth",
    )


def user_payload(user) -> dict:
    """Consistent user payload returned by auth endpoints."""
    return {"id": user.id, "name": user.name, "role": user.role}


@router.post("/register", status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest, response: Response):
    existing = await prisma.user.find_unique(where={"email": body.email})
    if existing:
        raise HTTPException(status_code=409, detail="Email address already registered")
    user = await prisma.user.create(data={
        "email": body.email,
        "name": body.name,
        "passwordHash": hash_password(body.password),
    })
    access_token = create_access_token(user.id)
    refresh_token = await create_refresh_token(user.id)
    set_refresh_cookie(response, refresh_token)
    return {"access_token": access_token, "user": user_payload(user)}


@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, response: Response):
    user = await prisma.user.find_unique(where={"email": body.email})
    if not user or not verify_password(body.password, user.passwordHash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access_token = create_access_token(user.id)
    refresh_token = await create_refresh_token(user.id)
    set_refresh_cookie(response, refresh_token)
    return {"access_token": access_token, "user": user_payload(user)}


@router.post("/refresh")
async def refresh(response: Response, refresh_token: str = Cookie(None)):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        access_token, new_refresh = await rotate_refresh_token(refresh_token)
        set_refresh_cookie(response, new_refresh)
        return {"access_token": access_token}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/logout")
async def logout(response: Response, refresh_token: str = Cookie(None)):
    if refresh_token:
        record = await prisma.refreshtoken.find_unique(where={"token": refresh_token})
        if record:
            await revoke_all_user_tokens(record.userId)
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    return {"message": "Logged out"}


@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    """Returns the current user's profile. Used by frontend on page refresh to rehydrate role."""
    return user_payload(current_user)


@router.put("/me/password", status_code=200)
async def change_password(
    body: ChangePasswordRequest,
    current_user=Depends(get_current_user),
):
    """Change the authenticated user's password. Requires their current password."""
    if not verify_password(body.current_password, current_user.passwordHash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    await prisma.user.update(
        where={"id": current_user.id},
        data={"passwordHash": hash_password(body.new_password)},
    )
    return {"message": "Password changed successfully"}
