from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.match_result import MatchResult
from app.models.user import User
from app.schemas.match import MatchViewResponse
from app.services.matching_service import current_week_monday

router = APIRouter()


@router.get("/current", response_model=MatchViewResponse)
async def get_current_match(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MatchViewResponse:
    week = current_week_monday()
    stmt = select(MatchResult).where(
        MatchResult.week_start == week,
        MatchResult.status == "visible",
        or_(MatchResult.user_a_id == user.id, MatchResult.user_b_id == user.id),
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No visible match yet")

    partner_id = row.user_b_id if row.user_a_id == user.id else row.user_a_id
    partner = (await db.execute(select(User).where(User.id == partner_id))).scalar_one()

    return MatchViewResponse(
        partner_system_id=partner.system_id,
        score=row.score,
        reason_text=row.reason_text,
        week_start=str(row.week_start),
    )
