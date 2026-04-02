import asyncio

from app.core.database import SessionLocal
from app.services.matching_service import build_weekly_matches, publish_weekly_matches


async def main() -> None:
    async with SessionLocal() as db:
        created = await build_weekly_matches(db)
        published = await publish_weekly_matches(db)
        print(f"created={created}, published={published}")


if __name__ == "__main__":
    asyncio.run(main())
