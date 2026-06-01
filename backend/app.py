import os

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware

from models import (
    Assignee,
    AssigneeListUpdate,
    DayOff,
    DayOffBulkCreate,
    DayOffDateList,
    DayOffListUpdate,
    PlannerData,
    Task,
    TaskCreate,
    TaskListUpdate,
)
from storage import (
    create_day_offs,
    create_task,
    delete_day_offs,
    delete_task,
    list_assignees,
    list_day_offs,
    list_tasks,
    replace_assignees,
    replace_day_offs,
    replace_tasks,
    update_task,
)


DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
DEFAULT_CORS_ORIGIN_REGEX = r"^http://(localhost|127\.0\.0\.1):\d+$"


def get_cors_origins() -> list[str]:
    configured_origins = os.environ.get("PROJECT_PLANNER_CORS_ORIGINS")

    if not configured_origins:
        return DEFAULT_CORS_ORIGINS

    return [
        origin.strip()
        for origin in configured_origins.split(",")
        if origin.strip()
    ]


def get_cors_origin_regex() -> str:
    return os.environ.get("PROJECT_PLANNER_CORS_ORIGIN_REGEX", DEFAULT_CORS_ORIGIN_REGEX)


app = FastAPI(title="Project Planner API")

# CORSMiddleware lets the local Vite frontend call the FastAPI backend in dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_origin_regex=get_cors_origin_regex(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health")
def get_health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks", response_model=list[Task])
def get_tasks() -> list[Task]:
    return list_tasks()


@app.get("/api/day-offs", response_model=list[DayOff])
def get_day_offs() -> list[DayOff]:
    return list_day_offs()


@app.get("/api/assignees", response_model=list[Assignee])
def get_assignees() -> list[Assignee]:
    return list_assignees()


@app.post("/api/tasks", response_model=Task, status_code=status.HTTP_201_CREATED)
def post_task(task_create: TaskCreate, after_task_id: str | None = None) -> Task:
    return create_task(task_create, after_task_id)


@app.post("/api/day-offs/bulk", response_model=list[DayOff], status_code=status.HTTP_201_CREATED)
def post_day_offs_bulk(day_off_create: DayOffBulkCreate) -> list[DayOff]:
    return create_day_offs(day_off_create)


@app.put("/api/tasks/bulk", response_model=list[Task])
def put_tasks_bulk(task_list_update: TaskListUpdate) -> list[Task]:
    return replace_tasks(task_list_update.tasks)


@app.put("/api/day-offs/bulk", response_model=list[DayOff])
def put_day_offs_bulk(day_off_list_update: DayOffListUpdate) -> list[DayOff]:
    return replace_day_offs(day_off_list_update.dayOffs)


@app.put("/api/assignees", response_model=PlannerData)
def put_assignees(assignee_list_update: AssigneeListUpdate) -> PlannerData:
    return replace_assignees(assignee_list_update)


@app.post("/api/tasks/bulk/sync", response_model=list[Task])
async def post_tasks_bulk_sync(request: Request) -> list[Task]:
    payload = await request.json()
    task_list_update = TaskListUpdate.model_validate(payload)

    return replace_tasks(task_list_update.tasks)


@app.put("/api/tasks/{task_id}", response_model=Task)
def put_task(task_id: str, task_update: TaskCreate) -> Task:
    return update_task(task_id, task_update)


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_task(task_id: str) -> Response:
    delete_task(task_id)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.delete("/api/day-offs", response_model=list[DayOff])
def remove_day_offs(day_off_dates: DayOffDateList) -> list[DayOff]:
    return delete_day_offs(day_off_dates.dates)
