from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.match_result import MatchResult
from app.models.questionnaire import Questionnaire
from app.models.user import User

router = APIRouter()


@router.get("/stats")
async def public_stats(db: AsyncSession = Depends(get_db)) -> dict[str, float | int]:
    users_count = int((await db.execute(select(func.count(User.id)))).scalar() or 0)
    questionnaire_count = int((await db.execute(select(func.count(Questionnaire.id)))).scalar() or 0)
    visible_match_count = int(
        (
            await db.execute(
                select(func.count(MatchResult.id)).where(MatchResult.status == "visible")
            )
        ).scalar()
        or 0
    )

    completion_rate = 0.0
    if users_count > 0:
        completion_rate = round(questionnaire_count / users_count * 100, 1)

    return {
        "verified_users": users_count,
        "questionnaire_completion_rate": completion_rate,
        "successful_moments": visible_match_count,
    }
