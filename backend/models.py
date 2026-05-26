from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


MAX_PROGRESS_PERCENT = 100
MIN_PROGRESS_PERCENT = 0


class TaskCreate(BaseModel):
    name: str = Field(min_length=1)
    description: Optional[str] = None
    url: Optional[str] = None
    assignee: Optional[str] = None
    taskType: str = Field(min_length=1)
    taskLevel: Optional[str] = None
    startDate: date
    stopDate: date
    progressPercent: int = Field(
        default=MIN_PROGRESS_PERCENT,
        ge=MIN_PROGRESS_PERCENT,
        le=MAX_PROGRESS_PERCENT,
    )

    @field_validator("name", "taskType")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        trimmed_value = value.strip()

        if not trimmed_value:
            raise ValueError("Field must not be empty.")

        return trimmed_value

    @field_validator("description", "url", "assignee", "taskLevel")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        trimmed_value = value.strip()

        if not trimmed_value:
            return None

        return trimmed_value

    @model_validator(mode="after")
    def validate_date_range(self) -> "TaskCreate":
        if self.stopDate < self.startDate:
            raise ValueError("Stop date must be on or after start date.")

        return self


class Task(TaskCreate):
    id: str


class TaskListUpdate(BaseModel):
    tasks: list[Task]
