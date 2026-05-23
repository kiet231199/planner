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
