from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, generate_system_id, get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, SendCodeRequest, TokenResponse, VerifyCodeRequest
from app.services.verification_service import check_verification_code, consume_verification_code, send_verification_code

router = APIRouter()


@router.post("/send-code")
async def send_code(payload: SendCodeRequest) -> dict[str, str]:
    await send_verification_code(payload.email)
    return {"message": "Verification code sent"}


@router.post("/verify-code")
async def verify_code(payload: VerifyCodeRequest) -> dict[str, bool]:
    ok = await check_verification_code(payload.email, payload.code)
    return {"verified": ok}


@router.post("/register", response_model=TokenResponse)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    if not await check_verification_code(payload.email, payload.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification code")

    await consume_verification_code(payload.email)

    exists = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    user = User(
        system_id=generate_system_id(),
        email=payload.email,
        password_hash=get_password_hash(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, system_id=user.system_id)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, system_id=user.system_id)
