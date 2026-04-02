from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import auth, contact, matches, public, questionnaire

app = FastAPI(title="Slow Social Matching API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(questionnaire.router, prefix="/api/questionnaire", tags=["questionnaire"])
app.include_router(matches.router, prefix="/api/matches", tags=["matches"])
app.include_router(contact.router, prefix="/api/contact", tags=["contact"])
app.include_router(public.router, prefix="/api/public", tags=["public"])


FRONTEND_ROOT = Path(__file__).resolve().parents[2]
app.mount("/", StaticFiles(directory=str(FRONTEND_ROOT), html=True), name="frontend")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
