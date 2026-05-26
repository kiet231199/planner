const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";


export async function listTasks() {
    return sendJsonRequest("/api/tasks");
}


export async function createTask(task) {
    return sendJsonRequest("/api/tasks", {
        method: "POST",
        body: JSON.stringify(task),
    });
}


export async function createTaskAfter(task, afterTaskId) {
    const queryString = afterTaskId ? `?after_task_id=${encodeURIComponent(afterTaskId)}` : "";

    return sendJsonRequest(`/api/tasks${queryString}`, {
        method: "POST",
        body: JSON.stringify(task),
    });
}


export async function updateTask(taskId, task) {
    return sendJsonRequest(`/api/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify(task),
    });
}


export async function replaceTasks(tasks) {
    return sendJsonRequest("/api/tasks/bulk", {
        method: "PUT",
        body: JSON.stringify({ tasks }),
    });
}


export function replaceTasksBeforeUnload(tasks) {
    const body = JSON.stringify({ tasks });
    const beaconPayload = new Blob([body], {
        type: "text/plain;charset=UTF-8",
    });

    if (
        navigator.sendBeacon
        && navigator.sendBeacon(`${API_BASE_URL}/api/tasks/bulk/sync`, beaconPayload)
    ) {
        return;
    }

    void fetch(`${API_BASE_URL}/api/tasks/bulk`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body,
        keepalive: true,
    }).catch(function ignoreUnloadSyncError() {});
}


export async function deleteTask(taskId) {
    await sendJsonRequest(`/api/tasks/${taskId}`, {
        method: "DELETE",
    });
}


async function sendJsonRequest(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
        ...options,
    });

    if (!response.ok) {
        throw new Error(await getErrorMessage(response));
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}


async function getErrorMessage(response) {
    try {
        const payload = await response.json();

        if (typeof payload.detail === "string") {
            return payload.detail;
        }

        return `Request failed with status ${response.status}.`;
    } catch {
        return `Request failed with status ${response.status}.`;
    }
}
