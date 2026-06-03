from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


MAX_PROGRESS_PERCENT = 100
MIN_PROGRESS_PERCENT = 0
HEX_COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"
UNASSIGNED_ASSIGNEE = "Unassigned"
DAY_OFF_ALL_ASSIGNEES = "All"
DEFAULT_TASK_LEVEL = "Level 1"
RELEASE_TASK_TYPE = "Release"
RESERVED_ASSIGNEE_NAMES = {
    UNASSIGNED_ASSIGNEE.casefold(),
    DAY_OFF_ALL_ASSIGNEES.casefold(),
}


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
        if self.taskType == RELEASE_TASK_TYPE:
            self.taskLevel = DEFAULT_TASK_LEVEL
            self.stopDate = self.startDate
            self.progressPercent = MAX_PROGRESS_PERCENT

        if self.stopDate < self.startDate:
            raise ValueError("Stop date must be on or after start date.")

        return self


class Task(TaskCreate):
    id: str


class TaskListUpdate(BaseModel):
    tasks: list[Task]


class DayOffCreate(BaseModel):
    date: date
    name: str = Field(min_length=1)
    description: Optional[str] = None
    assignees: list[str] = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        trimmed_value = value.strip()

        if not trimmed_value:
            raise ValueError("Field must not be empty.")

        return trimmed_value

    @field_validator("description")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        trimmed_value = value.strip()

        if not trimmed_value:
            return None

        return trimmed_value

    @field_validator("assignees")
    @classmethod
    def normalize_assignees(cls, value: list[str]) -> list[str]:
        normalized_assignees = []

        for assignee in value:
            trimmed_assignee = assignee.strip()

            if trimmed_assignee:
                normalized_assignees.append(trimmed_assignee)

        unique_assignees = list(dict.fromkeys(normalized_assignees))

        if not unique_assignees:
            raise ValueError("At least one assignee is required.")

        if "All" in unique_assignees:
            return ["All"]

        return unique_assignees


class DayOff(DayOffCreate):
    id: str


class DayOffListUpdate(BaseModel):
    dayOffs: list[DayOff]


class DayOffBulkCreate(BaseModel):
    dates: list[date] = Field(min_length=1)
    name: str = Field(min_length=1)
    description: Optional[str] = None
    assignees: list[str] = Field(min_length=1)

    @field_validator("dates")
    @classmethod
    def normalize_dates(cls, value: list[date]) -> list[date]:
        return list(dict.fromkeys(value))

    @model_validator(mode="after")
    def validate_day_off_draft(self) -> "DayOffBulkCreate":
        day_off_create = DayOffCreate(
            date=self.dates[0],
            name=self.name,
            description=self.description,
            assignees=self.assignees,
        )
        self.name = day_off_create.name
        self.description = day_off_create.description
        self.assignees = day_off_create.assignees

        return self


class DayOffDateList(BaseModel):
    dates: list[date] = Field(min_length=1)

    @field_validator("dates")
    @classmethod
    def normalize_dates(cls, value: list[date]) -> list[date]:
        return list(dict.fromkeys(value))


class Assignee(BaseModel):
    name: str = Field(min_length=1)
    backgroundColor: str = Field(pattern=HEX_COLOR_PATTERN)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        assignee_name = normalize_text_value(value)

        if assignee_name.casefold() in RESERVED_ASSIGNEE_NAMES:
            raise ValueError("Assignee name is reserved.")

        return assignee_name

    @field_validator("backgroundColor")
    @classmethod
    def normalize_background_color(cls, value: str) -> str:
        return value.strip()


class AssigneeRename(BaseModel):
    previousName: str = Field(min_length=1)
    nextName: str = Field(min_length=1)

    @field_validator("previousName", "nextName")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return normalize_text_value(value)


class AssigneeListUpdate(BaseModel):
    assignees: list[Assignee]
    renamedAssignees: list[AssigneeRename] = Field(default_factory=list)
    deletedAssignees: list[str] = Field(default_factory=list)

    @field_validator("assignees")
    @classmethod
    def validate_unique_assignee_names(cls, value: list[Assignee]) -> list[Assignee]:
        assignee_name_keys = [assignee.name.casefold() for assignee in value]

        if len(set(assignee_name_keys)) != len(assignee_name_keys):
            raise ValueError("Assignee names must be unique.")

        return value

    @field_validator("deletedAssignees")
    @classmethod
    def normalize_deleted_assignees(cls, value: list[str]) -> list[str]:
        normalized_names = []

        for assignee_name in value:
            normalized_name = assignee_name.strip()

            if normalized_name:
                normalized_names.append(normalized_name)

        return list(dict.fromkeys(normalized_names))


class PlannerData(BaseModel):
    tasks: list[Task]
    dayOffs: list[DayOff]
    assignees: list[Assignee]


def normalize_text_value(value: str) -> str:
    trimmed_value = value.strip()

    if not trimmed_value:
        raise ValueError("Field must not be empty.")

    return trimmed_value
