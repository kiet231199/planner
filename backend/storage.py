import json
import os
import tempfile
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status

from models import Task, TaskCreate


DEFAULT_DATA_FILE_PATH = Path(__file__).resolve().parent / "data" / "tasks.json"
DATA_FILE_PATH = Path(os.environ.get("PROJECT_PLANNER_DATA_FILE", DEFAULT_DATA_FILE_PATH))


def list_tasks() -> list[Task]:
    tasks = _read_tasks()

    return sorted(tasks, key=_sort_task)


def create_task(task_create: TaskCreate) -> Task:
    tasks = _read_tasks()
    task = Task(id=str(uuid4()), **task_create.model_dump())

    tasks.append(task)
    _write_tasks(tasks)

    return task


def delete_task(task_id: str) -> None:
    tasks = _read_tasks()
    remaining_tasks = [task for task in tasks if task.id != task_id]

    if len(remaining_tasks) == len(tasks):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    _write_tasks(remaining_tasks)


def _sort_task(task: Task) -> tuple[str, str]:
    return (task.startDate.isoformat(), task.name.lower())


def _read_tasks() -> list[Task]:
    _ensure_data_file()

    try:
        with DATA_FILE_PATH.open("r", encoding="utf-8") as data_file:
            payload = json.load(data_file)
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Task data file is malformed.",
        ) from error

    raw_tasks = _extract_raw_tasks(payload)

    try:
        return [Task.model_validate(raw_task) for raw_task in raw_tasks]
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Task data file contains invalid task records.",
        ) from error


def _write_tasks(tasks: list[Task]) -> None:
    DATA_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "tasks": [_serialize_task(task) for task in tasks],
    }

    with tempfile.NamedTemporaryFile(
        "w",
        delete=False,
        dir=DATA_FILE_PATH.parent,
        encoding="utf-8",
    ) as temporary_file:
        json.dump(payload, temporary_file, indent=4)
        temporary_file.write("\n")
        temporary_file_path = Path(temporary_file.name)

    os.replace(temporary_file_path, DATA_FILE_PATH)


def _ensure_data_file() -> None:
    if DATA_FILE_PATH.exists():
        return

    _write_tasks([])


def _extract_raw_tasks(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Task data file must contain an object.",
        )

    raw_tasks = payload.get("tasks")

    if raw_tasks is None:
        return []

    if not isinstance(raw_tasks, list):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Task data file must contain a tasks list.",
        )

    return raw_tasks


def _serialize_task(task: Task) -> dict[str, Any]:
    return task.model_dump(mode="json")
