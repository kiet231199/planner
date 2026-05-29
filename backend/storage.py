import json
import os
import tempfile
from datetime import date
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status

from models import DayOff, DayOffBulkCreate, Task, TaskCreate


DEFAULT_DATA_FILE_PATH = Path(__file__).resolve().parent / "data" / "tasks.json"
DATA_FILE_PATH = Path(os.environ.get("PROJECT_PLANNER_DATA_FILE", DEFAULT_DATA_FILE_PATH))


def list_tasks() -> list[Task]:
    return _read_tasks()


def list_day_offs() -> list[DayOff]:
    return _read_day_offs()


def create_task(task_create: TaskCreate, after_task_id: str | None = None) -> Task:
    tasks = _read_tasks()
    task = Task(id=str(uuid4()), **task_create.model_dump())

    if after_task_id:
        insertion_index = _get_task_index(tasks, after_task_id) + 1
        tasks.insert(insertion_index, task)
    else:
        tasks.append(task)

    _write_tasks(tasks)

    return task


def update_task(task_id: str, task_update: TaskCreate) -> Task:
    tasks = _read_tasks()
    task_index = _get_task_index(tasks, task_id)
    updated_task = Task(id=task_id, **task_update.model_dump())

    tasks[task_index] = updated_task
    _write_tasks(tasks)

    return updated_task


def replace_tasks(updated_tasks: list[Task]) -> list[Task]:
    updated_task_ids = [task.id for task in updated_tasks]

    if len(set(updated_task_ids)) != len(updated_task_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task list contains duplicate task IDs.",
        )

    _write_tasks(updated_tasks)

    return updated_tasks


def create_day_offs(day_off_create: DayOffBulkCreate) -> list[DayOff]:
    day_offs = _read_day_offs()
    day_off_dates = set(day_off_create.dates)
    remaining_day_offs = [
        day_off
        for day_off in day_offs
        if day_off.date not in day_off_dates
    ]
    created_day_offs = [
        DayOff(
            id=str(uuid4()),
            date=day_off_date,
            name=day_off_create.name,
            description=day_off_create.description,
            assignees=day_off_create.assignees,
        )
        for day_off_date in day_off_create.dates
    ]
    updated_day_offs = remaining_day_offs + created_day_offs

    _write_day_offs(updated_day_offs)

    return updated_day_offs


def replace_day_offs(updated_day_offs: list[DayOff]) -> list[DayOff]:
    updated_day_off_ids = [day_off.id for day_off in updated_day_offs]

    if len(set(updated_day_off_ids)) != len(updated_day_off_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Day-off list contains duplicate day-off IDs.",
        )

    _write_day_offs(updated_day_offs)

    return updated_day_offs


def delete_day_offs(day_off_dates: list[date]) -> list[DayOff]:
    day_offs = _read_day_offs()
    day_off_date_set = set(day_off_dates)
    remaining_day_offs = [
        day_off
        for day_off in day_offs
        if day_off.date not in day_off_date_set
    ]

    _write_day_offs(remaining_day_offs)

    return remaining_day_offs


def delete_task(task_id: str) -> None:
    tasks = _read_tasks()
    remaining_tasks = [task for task in tasks if task.id != task_id]

    if len(remaining_tasks) == len(tasks):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    _write_tasks(remaining_tasks)


def _get_task_index(tasks: list[Task], task_id: str) -> int:
    for index, task in enumerate(tasks):
        if task.id == task_id:
            return index

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Task not found.",
    )


def _read_tasks() -> list[Task]:
    payload = _read_data_payload()
    raw_tasks = _extract_raw_tasks(payload)

    try:
        return [Task.model_validate(raw_task) for raw_task in raw_tasks]
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Task data file contains invalid task records.",
        ) from error


def _read_day_offs() -> list[DayOff]:
    payload = _read_data_payload()
    raw_day_offs = _extract_raw_day_offs(payload)

    try:
        return [DayOff.model_validate(raw_day_off) for raw_day_off in raw_day_offs]
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Task data file contains invalid day-off records.",
        ) from error


def _write_tasks(tasks: list[Task]) -> None:
    payload = _read_data_payload()
    payload["tasks"] = [_serialize_task(task) for task in tasks]
    _write_data_payload(payload)


def _write_day_offs(day_offs: list[DayOff]) -> None:
    payload = _read_data_payload()
    payload["dayOffs"] = [_serialize_day_off(day_off) for day_off in day_offs]
    _write_data_payload(payload)


def _read_data_payload() -> dict[str, Any]:
    if not DATA_FILE_PATH.exists():
        return {
            "tasks": [],
            "dayOffs": [],
        }

    try:
        with DATA_FILE_PATH.open("r", encoding="utf-8") as data_file:
            payload = json.load(data_file)
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Task data file is malformed.",
        ) from error

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Task data file must contain an object.",
        )

    return payload


def _write_data_payload(payload: dict[str, Any]) -> None:
    DATA_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)

    normalized_payload = {
        "tasks": payload.get("tasks", []),
        "dayOffs": payload.get("dayOffs", []),
    }

    with tempfile.NamedTemporaryFile(
        "w",
        delete=False,
        dir=DATA_FILE_PATH.parent,
        encoding="utf-8",
    ) as temporary_file:
        json.dump(normalized_payload, temporary_file, indent=4)
        temporary_file.write("\n")
        temporary_file_path = Path(temporary_file.name)

    os.replace(temporary_file_path, DATA_FILE_PATH)


def _extract_raw_tasks(payload: Any) -> list[dict[str, Any]]:
    raw_tasks = payload.get("tasks")

    if raw_tasks is None:
        return []

    if not isinstance(raw_tasks, list):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Task data file must contain a tasks list.",
        )

    return raw_tasks


def _extract_raw_day_offs(payload: Any) -> list[dict[str, Any]]:
    raw_day_offs = payload.get("dayOffs")

    if raw_day_offs is None:
        return []

    if not isinstance(raw_day_offs, list):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Task data file must contain a dayOffs list.",
        )

    return raw_day_offs


def _serialize_task(task: Task) -> dict[str, Any]:
    return task.model_dump(mode="json")


def _serialize_day_off(day_off: DayOff) -> dict[str, Any]:
    return day_off.model_dump(mode="json")
