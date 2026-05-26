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
    return _read_tasks()


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
