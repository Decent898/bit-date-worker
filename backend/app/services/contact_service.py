from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match_result import MatchResult
from app.models.user import User
from app.services.email_service import send_text_email
from app.services.matching_service import current_week_monday


async def send_contact_message(db: AsyncSession, from_user: User, message: str) -> None:
    week = current_week_monday()

    stmt = select(MatchResult).where(
        MatchResult.week_start == week,
        MatchResult.status == "visible",
        or_(MatchResult.user_a_id == from_user.id, MatchResult.user_b_id == from_user.id),
    )
    match = (await db.execute(stmt)).scalar_one_or_none()
    if not match:
        raise ValueError("You do not have an active visible match this week")

    to_user_id = match.user_b_id if match.user_a_id == from_user.id else match.user_a_id
    user_stmt = select(User).where(User.id == to_user_id)
    to_user = (await db.execute(user_stmt)).scalar_one()

    body = (
        f"你收到来自 {from_user.system_id} 的慢社交留言：\\n\\n"
        f"{message}\\n\\n"
        "你可以直接回复此邮箱，或添加对方联系方式继续交流。"
    )
    send_text_email(to_user.email, "你的信封已送达：新留言", body)
