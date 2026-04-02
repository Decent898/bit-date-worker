from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.questionnaire import Questionnaire
from app.models.user import User
from app.schemas.questionnaire import QuestionnaireResponse, QuestionnaireUpsertRequest

router = APIRouter()


@router.put("", response_model=QuestionnaireResponse)
async def upsert_questionnaire(
    payload: QuestionnaireUpsertRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuestionnaireResponse:
    stmt = select(Questionnaire).where(Questionnaire.user_id == user.id)
    item = (await db.execute(stmt)).scalar_one_or_none()

    if not item:
        item = Questionnaire(user_id=user.id)
        db.add(item)

    item.profile = payload.profile
    item.objective_answers = payload.objective_answers
    item.personality_traits = payload.personality_traits
    item.preferences = payload.preferences
    item.tags = payload.tags
    item.opt_in_weekly = payload.opt_in_weekly

    await db.commit()
    await db.refresh(item)

    return QuestionnaireResponse(
        profile=item.profile,
        objective_answers=item.objective_answers,
        personality_traits=item.personality_traits,
        preferences=item.preferences,
        tags=item.tags,
        opt_in_weekly=item.opt_in_weekly,
    )


@router.get("", response_model=QuestionnaireResponse)
async def get_questionnaire(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuestionnaireResponse:
    stmt = select(Questionnaire).where(Questionnaire.user_id == user.id)
    item = (await db.execute(stmt)).scalar_one_or_none()

    if not item:
        return QuestionnaireResponse()

    return QuestionnaireResponse(
        profile=item.profile,
        objective_answers=item.objective_answers,
        personality_traits=item.personality_traits,
        preferences=item.preferences,
        tags=item.tags,
        opt_in_weekly=item.opt_in_weekly,
    )
