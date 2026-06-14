from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


MAX_PROGRESS_PERCENT = 100
MIN_PROGRESS_PERCENT = 0
HEX_COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"
UNASSIGNED_ASSIGNEE = "Unassigned"
DAY_OFF_ALL_ASSIGNEES = "All"
DEFAULT_TASK_LEVEL = "Level 1"
RELEASE_TASK_TYPE = "Release"
MULTI_PHASE_TASK_TYPE = "Multi-phase"
NO_PROJECT_NAME = "..."
RESERVED_ASSIGNEE_NAMES = {
    UNASSIGNED_ASSIGNEE.casefold(),
    DAY_OFF_ALL_ASSIGNEES.casefold(),
}


def get_sub_task_stop_date(sub_task: "SubTaskCreate") -> date:
    if sub_task.taskType == RELEASE_TASK_TYPE:
        return sub_task.startDate

    return sub_task.stopDate


def has_sub_task_overlap(sub_tasks: list["SubTaskCreate"]) -> bool:
    sorted_sub_tasks = sorted(
        sub_tasks,
        key=lambda sub_task: (sub_task.startDate, get_sub_task_stop_date(sub_task)),
    )

    for index, sub_task in enumerate(sorted_sub_tasks[:-1]):
        next_sub_task = sorted_sub_tasks[index + 1]

        if next_sub_task.startDate <= get_sub_task_stop_date(sub_task):
            return True

    return False


class SubTaskCreate(BaseModel):
    id: str
    name: str = Field(min_length=1)
    taskType: str = Field(min_length=1)
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

    @model_validator(mode="after")
    def validate_sub_task(self) -> "SubTaskCreate":
        if self.taskType == RELEASE_TASK_TYPE:
            self.stopDate = self.startDate
            self.progressPercent = MAX_PROGRESS_PERCENT

        if self.stopDate < self.startDate:
            raise ValueError("Stop date must be on or after start date.")

        return self


SubTask = SubTaskCreate


class ChildTask(BaseModel):
    id: str = Field(min_length=1)

    @field_validator("id")
    @classmethod
    def validate_child_task_id(cls, value: str) -> str:
        return normalize_text_value(value)


class TaskCreate(BaseModel):
    name: str = Field(min_length=1)
    description: Optional[str] = None
    url: Optional[str] = None
    assignee: Optional[str] = None
    projectName: str = NO_PROJECT_NAME
    taskType: str = Field(min_length=1)
    taskLevel: Optional[str] = None
    startDate: date
    stopDate: date
    progressPercent: int = Field(
        default=MIN_PROGRESS_PERCENT,
        ge=MIN_PROGRESS_PERCENT,
        le=MAX_PROGRESS_PERCENT,
    )
    subTasks: Optional[list[SubTask]] = None
    childTasks: Optional[list[ChildTask]] = None

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

    @field_validator("projectName")
    @classmethod
    def normalize_project_name(cls, value: str) -> str:
        trimmed_value = value.strip()

        if not trimmed_value:
            return NO_PROJECT_NAME

        return trimmed_value

    @model_validator(mode="after")
    def validate_date_range(self) -> "TaskCreate":
        if self.taskType == RELEASE_TASK_TYPE:
            self.taskLevel = DEFAULT_TASK_LEVEL
            self.stopDate = self.startDate
            self.progressPercent = MAX_PROGRESS_PERCENT

        if self.taskType == MULTI_PHASE_TASK_TYPE:
            self.taskLevel = DEFAULT_TASK_LEVEL

            if self.subTasks:
                self.subTasks = sorted(
                    self.subTasks,
                    key=lambda sub_task: (
                        sub_task.startDate,
                        get_sub_task_stop_date(sub_task),
                    ),
                )

                if has_sub_task_overlap(self.subTasks):
                    raise ValueError("Sub-tasks must not overlap.")
        else:
            self.subTasks = None

        if self.taskType in (RELEASE_TASK_TYPE, MULTI_PHASE_TASK_TYPE) and self.childTasks:
            raise ValueError("Release and multi-phase tasks cannot be parent tasks.")

        if self.taskType in (RELEASE_TASK_TYPE, MULTI_PHASE_TASK_TYPE):
            self.childTasks = None
        elif self.childTasks is not None:
            child_task_ids = [child_task.id for child_task in self.childTasks]

            if len(set(child_task_ids)) != len(child_task_ids):
                raise ValueError("Child task IDs must be unique.")

            if len(self.childTasks) == 0:
                self.childTasks = None

        if self.stopDate < self.startDate:
            raise ValueError("Stop date must be on or after start date.")

        return self


class Task(TaskCreate):
    id: str


class Dependency(BaseModel):
    id: str = Field(min_length=1)
    fromTaskId: str = Field(min_length=1)
    fromSide: Literal["left", "right"]
    toTaskId: str = Field(min_length=1)
    toSide: Literal["left", "right"]

    @field_validator("id", "fromTaskId", "toTaskId")
    @classmethod
    def validate_dependency_text(cls, value: str) -> str:
        return normalize_text_value(value)

    @model_validator(mode="after")
    def validate_dependency(self) -> "Dependency":
        if self.fromTaskId == self.toTaskId:
            raise ValueError("Dependency tasks must be different.")

        if self.fromSide == self.toSide:
            raise ValueError("Dependency sides must be different.")

        return self


class TaskListUpdate(BaseModel):
    tasks: list[Task]
    dependency: Optional[list[Dependency]] = None


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


class ProjectName(BaseModel):
    name: str = Field(min_length=1)
    backgroundColor: str = Field(pattern=HEX_COLOR_PATTERN)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return normalize_text_value(value)

    @field_validator("backgroundColor")
    @classmethod
    def normalize_background_color(cls, value: str) -> str:
        return value.strip()


class ProjectRename(BaseModel):
    previousName: str = Field(min_length=1)
    nextName: str = Field(min_length=1)

    @field_validator("previousName", "nextName")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return normalize_text_value(value)


class ProjectNameListUpdate(BaseModel):
    project_name: list[ProjectName]
    renamedProjects: list[ProjectRename] = Field(default_factory=list)
    deletedProjects: list[str] = Field(default_factory=list)

    @field_validator("project_name")
    @classmethod
    def validate_unique_project_names(cls, value: list[ProjectName]) -> list[ProjectName]:
        project_name_keys = [project_name.name.casefold() for project_name in value]

        if len(set(project_name_keys)) != len(project_name_keys):
            raise ValueError("Project names must be unique.")

        return value

    @field_validator("deletedProjects")
    @classmethod
    def normalize_deleted_projects(cls, value: list[str]) -> list[str]:
        normalized_names = []

        for project_name in value:
            normalized_name = project_name.strip()

            if normalized_name:
                normalized_names.append(normalized_name)

        return list(dict.fromkeys(normalized_names))


class PlannerData(BaseModel):
    tasks: list[Task]
    dayOffs: list[DayOff]
    assignees: list[Assignee]
    project_name: list[ProjectName]
    dependency: list[Dependency] = Field(default_factory=list)


def normalize_text_value(value: str) -> str:
    trimmed_value = value.strip()

    if not trimmed_value:
        raise ValueError("Field must not be empty.")

    return trimmed_value
