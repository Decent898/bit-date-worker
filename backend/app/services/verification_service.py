import random
import re

from fastapi import HTTPException, status

from app.core.config import settings
from app.core.redis_client import redis_client
from app.services.email_service import send_text_email


def validate_edu_email(email: str) -> None:
    regex_ok = bool(re.fullmatch(settings.EDU_EMAIL_REGEX, email))
    suffix_ok = email.lower().endswith(".edu.cn") and "@" in email
    if not (regex_ok or suffix_ok):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .edu.cn emails are allowed")


async def send_verification_code(email: str) -> None:
    validate_edu_email(email)
    code = f"{random.randint(100000, 999999)}"

    await redis_client.setex(f"verify:{email}", 600, code)
    send_text_email(email, "校园慢社交验证码", f"你的验证码是 {code}，10 分钟内有效。")


async def check_verification_code(email: str, code: str) -> bool:
    cached = await redis_client.get(f"verify:{email}")
    return cached == code


async def consume_verification_code(email: str) -> None:
    await redis_client.delete(f"verify:{email}")
