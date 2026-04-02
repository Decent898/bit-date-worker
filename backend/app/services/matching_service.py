import math
from datetime import date, timedelta

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match_result import MatchResult
from app.models.questionnaire import Questionnaire
from app.models.user import User
from app.services.llm_service import generate_reason


def current_week_monday(today: date | None = None) -> date:
    now = today or date.today()
    return now - timedelta(days=now.weekday())


def _vector_from_objective(answers: dict) -> list[float]:
    fields = ["sleep_time", "wake_time", "spending_style", "social_frequency", "exercise"]
    vector = []
    for field in fields:
        value = answers.get(field, 0)
        try:
            vector.append(float(value))
        except (TypeError, ValueError):
            vector.append(0.0)
    return vector


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _complement_score(traits_a: dict, traits_b: dict) -> float:
    role_a = traits_a.get("role", "")
    role_b = traits_b.get("role", "")

    pair_bonus = {
        ("leader", "supporter"): 1.0,
        ("supporter", "leader"): 1.0,
        ("planner", "explorer"): 0.8,
        ("explorer", "planner"): 0.8,
    }
    return pair_bonus.get((role_a, role_b), 0.3)


def _orientation_accepts(self_profile: dict, other_profile: dict) -> bool:
    self_gender = self_profile.get("gender")
    other_gender = other_profile.get("gender")
    orientation = self_profile.get("orientation", "all")

    if orientation == "all":
        return True
    if orientation == "same":
        return self_gender == other_gender
    if orientation == "different":
        return self_gender != other_gender
    return False


def _age_accepts(self_pref: dict, self_profile: dict, other_profile: dict) -> bool:
    self_age = self_profile.get("age", 0)
    other_age = other_profile.get("age", 0)
    min_age = self_pref.get("min_age", 0)
    max_age = self_pref.get("max_age", 100)

    try:
        self_age = int(self_age)
        other_age = int(other_age)
        min_age = int(min_age)
        max_age = int(max_age)
    except (TypeError, ValueError):
        return True

    _ = self_age
    return min_age <= other_age <= max_age


def pass_hard_filters(a: Questionnaire, b: Questionnaire) -> bool:
    if not _orientation_accepts(a.profile, b.profile):
        return False
    if not _orientation_accepts(b.profile, a.profile):
        return False
    if not _age_accepts(a.preferences, a.profile, b.profile):
        return False
    if not _age_accepts(b.preferences, b.profile, a.profile):
        return False
    return True


def calculate_score(a: Questionnaire, b: Questionnaire) -> float:
    sim = _cosine_similarity(_vector_from_objective(a.objective_answers), _vector_from_objective(b.objective_answers))
    comp = _complement_score(a.personality_traits, b.personality_traits)
    tag_overlap = len(set(a.tags or []) & set(b.tags or []))
    tag_score = min(tag_overlap / 5, 1.0)

    final_score = 0.55 * sim + 0.30 * comp + 0.15 * tag_score
    return round(final_score * 100, 2)


async def build_weekly_matches(db: AsyncSession) -> int:
    week = current_week_monday()

    await db.execute(delete(MatchResult).where(MatchResult.week_start == week))

    stmt = select(Questionnaire).where(Questionnaire.opt_in_weekly.is_(True))
    rows = (await db.execute(stmt)).scalars().all()

    candidates = [q for q in rows if q.profile and q.preferences]
    scores: list[tuple[float, Questionnaire, Questionnaire]] = []

    for i in range(len(candidates)):
        for j in range(i + 1, len(candidates)):
            a, b = candidates[i], candidates[j]
            if not pass_hard_filters(a, b):
                continue
            score = calculate_score(a, b)
            scores.append((score, a, b))

    scores.sort(key=lambda x: x[0], reverse=True)

    used_users = set()
    created = 0

    for score, a, b in scores:
        if a.user_id in used_users or b.user_id in used_users:
            continue

        user_stmt = select(User).where(or_(User.id == a.user_id, User.id == b.user_id))
        users = (await db.execute(user_stmt)).scalars().all()
        user_map = {u.id: u for u in users}

        reason = await generate_reason(
            {
                "system_id": user_map[a.user_id].system_id,
                "profile": a.profile,
                "traits": a.personality_traits,
                "tags": a.tags,
            },
            {
                "system_id": user_map[b.user_id].system_id,
                "profile": b.profile,
                "traits": b.personality_traits,
                "tags": b.tags,
            },
            score,
        )

        db.add(
            MatchResult(
                week_start=week,
                user_a_id=a.user_id,
                user_b_id=b.user_id,
                score=score,
                reason_text=reason,
                status="hidden",
            )
        )

        used_users.add(a.user_id)
        used_users.add(b.user_id)
        created += 1

    await db.commit()
    return created


async def publish_weekly_matches(db: AsyncSession) -> int:
    week = current_week_monday()
    stmt = select(MatchResult).where(
        MatchResult.week_start == week,
        MatchResult.status == "hidden",
    )
    matches = (await db.execute(stmt)).scalars().all()

    for item in matches:
        item.status = "visible"

    await db.commit()
    return len(matches)
