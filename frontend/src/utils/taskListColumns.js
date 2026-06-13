import {
    DEFAULT_TASK_LEVEL,
    MULTI_PHASE_TASK_TYPE,
    NO_PROJECT_NAME,
    RELEASE_TASK_TYPE,
    UNASSIGNED_ASSIGNEE,
} from "../constants/taskOptions";


export const TASK_LIST_COLUMN_VISIBILITY_STORAGE_KEY = "planner-task-list-columns";
export const TASK_LIST_SORT_NONE = "none";
export const TASK_LIST_SORT_ASCENDING = "ascending";
export const TASK_LIST_SORT_DESCENDING = "descending";

export const TASK_LIST_COLUMNS = [
    {
        id: "name",
        label: "Task name",
        minimumWidth: 124,
        width: "minmax(124px, 1fr)",
        canHide: false,
        canFilter: false,
        canSort: false,
        defaultVisible: true,
        sortType: "text",
    },
    {
        id: "assignee",
        label: "Assignee",
        minimumWidth: 128,
        width: "128px",
        canHide: true,
        canFilter: true,
        canSort: true,
        defaultVisible: true,
        sortType: "text",
    },
    {
        id: "taskType",
        label: "Task type",
        minimumWidth: 104,
        width: "104px",
        canHide: true,
        canFilter: true,
        canSort: true,
        defaultVisible: false,
        sortType: "text",
    },
    {
        id: "taskLevel",
        label: "Task level",
        minimumWidth: 104,
        width: "104px",
        canHide: true,
        canFilter: true,
        canSort: true,
        defaultVisible: false,
        sortType: "text",
    },
    {
        id: "projectName",
        label: "Project",
        minimumWidth: 112,
        width: "112px",
        canHide: true,
        canFilter: true,
        canSort: true,
        defaultVisible: false,
        sortType: "text",
    },
    {
        id: "progressPercent",
        label: "Progress",
        minimumWidth: 96,
        width: "96px",
        canHide: true,
        canFilter: false,
        canSort: true,
        defaultVisible: true,
        sortType: "number",
    },
    {
        id: "startDate",
        label: "Start date",
        minimumWidth: 112,
        width: "112px",
        canHide: true,
        canFilter: false,
        canSort: true,
        defaultVisible: false,
        sortType: "date",
    },
    {
        id: "stopDate",
        label: "End date",
        minimumWidth: 112,
        width: "112px",
        canHide: true,
        canFilter: false,
        canSort: true,
        defaultVisible: false,
        sortType: "date",
    },
];


export function getTaskListColumn(columnId) {
    return TASK_LIST_COLUMNS.find(function matchColumn(column) {
        return column.id === columnId;
    }) || null;
}


export function getDefaultTaskListColumnVisibility() {
    return TASK_LIST_COLUMNS.reduce(function mapColumnVisibility(visibility, column) {
        visibility[column.id] = column.defaultVisible;

        return visibility;
    }, {});
}


export function getTaskListColumnsMinimumWidth(columns) {
    return columns.reduce(function sumColumnMinimumWidth(totalWidth, column) {
        return totalWidth + column.minimumWidth;
    }, 0);
}


export function getTaskListColumnValue(task, columnId) {
    if (columnId === "name") {
        return task.name || "";
    }

    if (columnId === "assignee") {
        return getTaskAssigneeLabel(task);
    }

    if (columnId === "taskType") {
        return task.taskType || "";
    }

    if (columnId === "taskLevel") {
        return getTaskLevelLabel(task);
    }

    if (columnId === "projectName") {
        return task.projectName || NO_PROJECT_NAME;
    }

    if (columnId === "progressPercent") {
        return getTaskProgressValue(task);
    }

    if (columnId === "startDate") {
        return task.startDate || "";
    }

    if (columnId === "stopDate") {
        return getTaskStopDateLabel(task);
    }

    return "";
}


export function getTaskListColumnDisplayValue(task, columnId) {
    const value = getTaskListColumnValue(task, columnId);

    if (columnId === "progressPercent") {
        return `${value}%`;
    }

    return String(value);
}


export function getTaskAssigneeLabel(task) {
    const assigneeLabel = task.assignee || "";
    const trimmedAssigneeLabel = assigneeLabel.trim();

    if (!trimmedAssigneeLabel) {
        return UNASSIGNED_ASSIGNEE;
    }

    return trimmedAssigneeLabel;
}


function getTaskLevelLabel(task) {
    if (task.taskType === RELEASE_TASK_TYPE || task.taskType === MULTI_PHASE_TASK_TYPE) {
        return DEFAULT_TASK_LEVEL;
    }

    return task.taskLevel || DEFAULT_TASK_LEVEL;
}


function getTaskProgressValue(task) {
    if (task.taskType === RELEASE_TASK_TYPE) {
        return 100;
    }

    return task.progressPercent || 0;
}


function getTaskStopDateLabel(task) {
    if (task.taskType === RELEASE_TASK_TYPE) {
        return task.startDate || "";
    }

    return task.stopDate || "";
}
