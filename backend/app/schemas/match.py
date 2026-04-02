from pydantic import BaseModel


class MatchViewResponse(BaseModel):
    partner_system_id: str
    score: float
    reason_text: str
    week_start: str


class ContactMessageRequest(BaseModel):
    message: str
