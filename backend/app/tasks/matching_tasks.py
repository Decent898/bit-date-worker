import asyncio

from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.matching_service import build_weekly_matches, publish_weekly_matches


@celery_app.task(name="app.tasks.matching_tasks.build_weekly_matches")
def build_weekly_matches_task() -> int:
    async def _run() -> int:
        async with SessionLocal() as db:
            return await build_weekly_matches(db)

    return asyncio.run(_run())


@celery_app.task(name="app.tasks.matching_tasks.publish_weekly_matches")
def publish_weekly_matches_task() -> int:
    async def _run() -> int:
        async with SessionLocal() as db:
            return await publish_weekly_matches(db)

    return asyncio.run(_run())
