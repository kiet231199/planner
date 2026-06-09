export const UNASSIGNED_ASSIGNEE = "Unassigned";

export const DAY_OFF_ALL_ASSIGNEES = "All";
export const NO_PROJECT_NAME = "...";

export const ASSIGNEE_OPTIONS = [UNASSIGNED_ASSIGNEE, "Alice", "Bob", "Charlie"];

export const DEFAULT_TASK_TYPE = "Plan";
export const RELEASE_TASK_TYPE = "Release";
export const TASK_TYPE_OPTIONS = [
    "Plan",
    "Design",
    "Bug",
    "Dev",
    "Test",
    "Doc",
    RELEASE_TASK_TYPE,
];

export const TASK_TYPE_COLORS = {
    Plan: "#b71c1c",
    Design: "#fb8c00",
    Bug: "#fdd835",
    Dev: "#3eb489",
    Test: "#64b5f6",
    Doc: "#8e24aa",
    Release: "#52595d",
};

export const DEFAULT_TASK_TYPE_COLOR = TASK_TYPE_COLORS[DEFAULT_TASK_TYPE];

export const DEFAULT_TASK_LEVEL = "Level 1";
export const TASK_LEVEL_OPTIONS = [
    DEFAULT_TASK_LEVEL,
    "Level 2",
    "Level 3",
];
