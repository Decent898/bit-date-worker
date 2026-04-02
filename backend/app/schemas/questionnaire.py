from pydantic import BaseModel, Field


class QuestionnaireUpsertRequest(BaseModel):
    profile: dict = Field(default_factory=dict)
    objective_answers: dict = Field(default_factory=dict)
    personality_traits: dict = Field(default_factory=dict)
    preferences: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    opt_in_weekly: bool = False


class QuestionnaireResponse(QuestionnaireUpsertRequest):
    pass
