from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "slow_social",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.matching_tasks"],
)

celery_app.autodiscover_tasks(["app.tasks"])
celery_app.conf.timezone = "Asia/Shanghai"
celery_app.conf.beat_schedule = {
    "weekly-match-build": {
        "task": "app.tasks.matching_tasks.build_weekly_matches_task",
        "schedule": crontab(minute=0, hour=1, day_of_week="mon"),
    },
    "weekly-match-publish": {
        "task": "app.tasks.matching_tasks.publish_weekly_matches_task",
        "schedule": crontab(minute=0, hour=21, day_of_week="tue"),
    },
}
