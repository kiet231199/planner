import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, CssBaseline, Snackbar, ThemeProvider, createTheme } from "@mui/material";

import { listTasks, replaceTasks, replaceTasksBeforeUnload } from "./api/tasksClient";
import PlannerShell from "./components/PlannerShell";
import {
    DEFAULT_ZOOM_INDEX,
    MAX_ZOOM_INDEX,
    MIN_ZOOM_INDEX,
    addDaysToDateString,
} from "./utils/chartScale";


const COLOR_MODE_STORAGE_KEY = "planner-color-mode";
const HISTORY_LIMIT = 30;
const SAVE_ACTION_THRESHOLD = 10;
const SAVE_INTERVAL_MILLISECONDS = 60 * 1000;
const CLIENT_TASK_ID_PREFIX = "task";
const BUTTON_LABEL_LINE_HEIGHT = 1.2;
const LIGHT_COLOR_MODE = "light";
const DARK_COLOR_MODE = "dark";

const CATPPUCCIN_LATTE = {
    base: "#eff1f5",
    mantle: "#e6e9ef",
    crust: "#dce0e8",
    surface0: "#ccd0da",
    surface1: "#bcc0cc",
    surface2: "#acb0be",
    overlay0: "#9ca0b0",
    overlay1: "#8c8fa1",
    overlay2: "#7c7f93",
    subtext0: "#6c6f85",
    subtext1: "#5c5f77",
    text: "#4c4f69",
    blue: "#1e66f5",
    lavender: "#7287fd",
    mauve: "#8839ef",
    red: "#d20f39",
    peach: "#fe640b",
    yellow: "#df8e1d",
    green: "#40a02b",
    teal: "#179299",
    sky: "#04a5e5",
};

const CATPPUCCIN_MACCHIATO = {
    base: "#24273a",
    mantle: "#1e2030",
    crust: "#181926",
    surface0: "#363a4f",
    surface1: "#494d64",
    surface2: "#5b6078",
    overlay0: "#6e738d",
    overlay1: "#8087a2",
    overlay2: "#939ab7",
    subtext0: "#a5adcb",
    subtext1: "#b8c0e0",
    text: "#cad3f5",
    blue: "#8aadf4",
    lavender: "#b7bdf8",
    mauve: "#c6a0f6",
    red: "#ed8796",
    peach: "#f5a97f",
    yellow: "#eed49f",
    green: "#a6da95",
    teal: "#8bd5ca",
    sky: "#91d7e3",
};


export default function App() {
    const [colorMode, setColorMode] = useState(getInitialColorMode);
    const [tasks, setTasks] = useState([]);
    const [selectedTaskIds, setSelectedTaskIds] = useState([]);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
    const [drawerMode, setDrawerMode] = useState("create");
    const [isLoading, setIsLoading] = useState(true);
    const isSaving = false;
    const [errorMessage, setErrorMessage] = useState("");
    const [historyState, setHistoryState] = useState({
        canUndo: false,
        canRedo: false,
    });
    const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
    const tasksRef = useRef([]);
    const selectedTaskIdsRef = useRef([]);
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);
    const isDirtyRef = useRef(false);
    const pendingActionCountRef = useRef(0);
    const isSavingRef = useRef(false);

    const theme = useMemo(function createThemeForColorMode() {
        return createPlannerTheme(colorMode);
    }, [colorMode]);

    useEffect(function syncDocumentColorMode() {
        document.documentElement.dataset.colorMode = colorMode;
    }, [colorMode]);

    useEffect(function loadInitialTasks() {
        loadTasks();
    }, []);

    useEffect(function keepLatestTasksReference() {
        tasksRef.current = tasks;
    }, [tasks]);

    useEffect(function keepLatestSelectionReference() {
        selectedTaskIdsRef.current = selectedTaskIds;
    }, [selectedTaskIds]);

    useEffect(function bindTaskKeyboardShortcuts() {
        function handleGlobalKeyDown(event) {
            if (shouldUndoTasks(event, isDrawerOpen)) {
                event.preventDefault();
                handleUndoTaskChange();
                return;
            }

            if (shouldRedoTasks(event, isDrawerOpen)) {
                event.preventDefault();
                handleRedoTaskChange();
                return;
            }

            if (!shouldDeleteSelectedTasks(event, isDrawerOpen, selectedTaskIds)) {
                return;
            }

            event.preventDefault();
            handleDeleteSelectedTask();
        }

        window.addEventListener("keydown", handleGlobalKeyDown);

        return function removeTaskKeyboardShortcuts() {
            window.removeEventListener("keydown", handleGlobalKeyDown);
        };
    }, [isDrawerOpen, selectedTaskIds]);

    useEffect(function scheduleDirtyTaskSync() {
        const intervalId = window.setInterval(function syncDirtyTasks() {
            if (!isDirtyRef.current) {
                return;
            }

            flushTasksToBackend();
        }, SAVE_INTERVAL_MILLISECONDS);

        return function clearDirtyTaskSync() {
            window.clearInterval(intervalId);
        };
    }, []);

    useEffect(function bindUnloadTaskSync() {
        function handleBeforeUnload() {
            if (!isDirtyRef.current) {
                return;
            }

            replaceTasksBeforeUnload(tasksRef.current);
        }

        window.addEventListener("beforeunload", handleBeforeUnload);

        return function removeUnloadTaskSync() {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

    async function loadTasks() {
        setIsLoading(true);

        try {
            const loadedTasks = await listTasks();
            setTasks(loadedTasks);
            clearMissingSelection(loadedTasks);
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleCreateTask(taskDraft) {
        const beforeTasks = tasksRef.current;
        const beforeSelectedTaskIds = selectedTaskIdsRef.current;
        const afterTaskId = getLastSelectedTaskId(beforeSelectedTaskIds);
        const createdTask = {
            id: createClientTaskId(),
            ...taskDraft,
        };
        const afterTasks = insertTaskAfter(beforeTasks, createdTask, afterTaskId);
        const afterSelectedTaskIds = [createdTask.id];

        commitTaskChange(
            beforeTasks,
            afterTasks,
            beforeSelectedTaskIds,
            afterSelectedTaskIds,
            "Add task",
        );
        setIsDrawerOpen(false);

        return true;
    }

    async function handleUpdateTask(taskDraft) {
        const beforeTasks = tasksRef.current;
        const beforeSelectedTaskIds = selectedTaskIdsRef.current;
        const taskId = getLastSelectedTaskId(beforeSelectedTaskIds);

        if (!taskId) {
            return false;
        }

        const currentTask = beforeTasks.find(function matchTask(task) {
            return task.id === taskId;
        });

        if (!currentTask) {
            return false;
        }

        const updatedTask = {
            ...currentTask,
            ...taskDraft,
            id: taskId,
        };
        const afterTasks = replaceTaskById(beforeTasks, updatedTask);
        const afterSelectedTaskIds = [taskId];

        if (hasSameTaskList(beforeTasks, afterTasks)) {
            setIsDrawerOpen(false);
            return true;
        }

        commitTaskChange(
            beforeTasks,
            afterTasks,
            beforeSelectedTaskIds,
            afterSelectedTaskIds,
            "Edit task",
        );
        setIsDrawerOpen(false);

        return true;
    }

    async function handleMoveTasks(taskId, dayDelta, rowDelta) {
        if (dayDelta === 0 && rowDelta === 0) {
            return;
        }

        const beforeTasks = tasksRef.current;
        const beforeSelectedTaskIds = selectedTaskIdsRef.current;
        const movingTaskIds = getMovingTaskIds(beforeTasks, beforeSelectedTaskIds, taskId);
        const movedTasks = moveTasks(beforeTasks, movingTaskIds, taskId, dayDelta, rowDelta);

        if (hasSameTaskList(beforeTasks, movedTasks)) {
            return;
        }

        commitTaskChange(
            beforeTasks,
            movedTasks,
            beforeSelectedTaskIds,
            movingTaskIds,
            "Move task",
        );
    }

    async function handleResizeTaskDates(taskId, resizeEdge, dayDelta) {
        if (dayDelta === 0) {
            return;
        }

        const beforeTasks = tasksRef.current;
        const beforeSelectedTaskIds = selectedTaskIdsRef.current;
        const task = beforeTasks.find(function matchTask(currentTask) {
            return currentTask.id === taskId;
        });

        if (!task) {
            return;
        }

        const optimisticTask = getResizedTask(task, resizeEdge, dayDelta);

        if (hasSameTaskValues(task, optimisticTask)) {
            return;
        }

        const afterTasks = replaceTaskById(beforeTasks, optimisticTask);

        commitTaskChange(
            beforeTasks,
            afterTasks,
            beforeSelectedTaskIds,
            [task.id],
            "Resize task",
        );
    }

    async function handleDeleteSelectedTask() {
        const beforeTasks = tasksRef.current;
        const beforeSelectedTaskIds = selectedTaskIdsRef.current;

        if (beforeSelectedTaskIds.length === 0) {
            return;
        }

        const deleteTaskIds = new Set(beforeSelectedTaskIds);
        const afterTasks = beforeTasks.filter(function keepTask(task) {
            return !deleteTaskIds.has(task.id);
        });

        commitTaskChange(
            beforeTasks,
            afterTasks,
            beforeSelectedTaskIds,
            [],
            "Delete task",
        );
    }

    function handleAddTaskClick() {
        setDrawerMode("create");
        setIsDrawerOpen(true);
    }

    function handleEditSelectedTask() {
        if (selectedTaskIds.length !== 1) {
            return;
        }

        setDrawerMode("edit");
        setIsDrawerOpen(true);
    }

    function handleOpenTaskEdit(taskId) {
        setSelectedTaskIds([taskId]);
        setDrawerMode("edit");
        setIsDrawerOpen(true);
    }

    function handleUndoTaskChange() {
        const historyEntry = undoStackRef.current.pop();

        if (!historyEntry) {
            refreshHistoryState();
            return;
        }

        pushLimitedHistoryEntry(redoStackRef.current, historyEntry);
        applyTaskSnapshot(historyEntry.beforeTasks, historyEntry.selectedTaskIdsBefore);
        markTasksDirty();
        refreshHistoryState();
    }

    function handleRedoTaskChange() {
        const historyEntry = redoStackRef.current.pop();

        if (!historyEntry) {
            refreshHistoryState();
            return;
        }

        pushLimitedHistoryEntry(undoStackRef.current, historyEntry);
        applyTaskSnapshot(historyEntry.afterTasks, historyEntry.selectedTaskIdsAfter);
        markTasksDirty();
        refreshHistoryState();
    }

    function commitTaskChange(
        beforeTasks,
        afterTasks,
        selectedTaskIdsBefore,
        selectedTaskIdsAfter,
        label,
    ) {
        if (
            hasSameTaskList(beforeTasks, afterTasks)
            && hasSameTaskSelection(selectedTaskIdsBefore, selectedTaskIdsAfter)
        ) {
            return;
        }

        const historyEntry = {
            beforeTasks: cloneTasks(beforeTasks),
            afterTasks: cloneTasks(afterTasks),
            selectedTaskIdsBefore: [...selectedTaskIdsBefore],
            selectedTaskIdsAfter: [...selectedTaskIdsAfter],
            label,
        };

        pushLimitedHistoryEntry(undoStackRef.current, historyEntry);
        redoStackRef.current = [];
        applyTaskSnapshot(afterTasks, selectedTaskIdsAfter);
        markTasksDirty();
        refreshHistoryState();
    }

    function applyTaskSnapshot(nextTasks, nextSelectedTaskIds) {
        const clonedTasks = cloneTasks(nextTasks);
        const clonedSelectedTaskIds = [...nextSelectedTaskIds];

        tasksRef.current = clonedTasks;
        selectedTaskIdsRef.current = clonedSelectedTaskIds;
        setTasks(clonedTasks);
        setSelectedTaskIds(clonedSelectedTaskIds);
    }

    function markTasksDirty() {
        isDirtyRef.current = true;
        pendingActionCountRef.current += 1;

        if (pendingActionCountRef.current >= SAVE_ACTION_THRESHOLD) {
            flushTasksToBackend();
        }
    }

    async function flushTasksToBackend() {
        if (isSavingRef.current || !isDirtyRef.current) {
            return;
        }

        const tasksToSave = cloneTasks(tasksRef.current);
        isSavingRef.current = true;

        try {
            await replaceTasks(tasksToSave);

            if (hasSameTaskList(tasksRef.current, tasksToSave)) {
                isDirtyRef.current = false;
                pendingActionCountRef.current = 0;
            }
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            isSavingRef.current = false;
        }
    }

    function refreshHistoryState() {
        setHistoryState({
            canUndo: undoStackRef.current.length > 0,
            canRedo: redoStackRef.current.length > 0,
        });
    }

    function handleSelectTask(taskId, isMultiSelect) {
        if (isMultiSelect) {
            setSelectedTaskIds(function toggleTaskSelection(currentTaskIds) {
                return toggleSelectedTaskId(currentTaskIds, taskId);
            });
            return;
        }

        setSelectedTaskIds(function selectSingleTask(currentTaskIds) {
            if (currentTaskIds.length === 1 && currentTaskIds[0] === taskId) {
                return currentTaskIds;
            }

            return [taskId];
        });
    }

    function handleTimelineZoom(zoomDirection) {
        setZoomIndex(function updateZoom(currentZoomIndex) {
            const nextZoomIndex = currentZoomIndex + zoomDirection;

            return Math.min(Math.max(nextZoomIndex, MIN_ZOOM_INDEX), MAX_ZOOM_INDEX);
        });
    }

    function handleColorModeToggle() {
        setColorMode(function toggleColorMode(currentColorMode) {
            const nextColorMode = getNextColorMode(currentColorMode);
            saveColorMode(nextColorMode);

            return nextColorMode;
        });
    }

    function handleSettingsClick() {
        setIsSettingsDrawerOpen(true);
    }

    function clearMissingSelection(loadedTasks) {
        setSelectedTaskIds(function clearSelection(currentSelectedTaskIds) {
            const loadedTaskIds = new Set(loadedTasks.map(function mapTaskId(task) {
                return task.id;
            }));

            return currentSelectedTaskIds.filter(function keepTaskId(taskId) {
                return loadedTaskIds.has(taskId);
            });
        });
    }

    function closeErrorMessage() {
        setErrorMessage("");
    }

    const selectedTaskId = getLastSelectedTaskId(selectedTaskIds);
    const selectedTask = tasks.find(function matchSelectedTask(task) {
        return task.id === selectedTaskId;
    }) || null;
    const canEditSelectedTask = selectedTaskIds.length === 1;

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box className="app-root" data-color-mode={colorMode}>
                <PlannerShell
                    tasks={tasks}
                    selectedTaskId={selectedTaskId}
                    selectedTaskIds={selectedTaskIds}
                    isDrawerOpen={isDrawerOpen}
                    isSettingsDrawerOpen={isSettingsDrawerOpen}
                    isLoading={isLoading}
                    isSaving={isSaving}
                    canRedo={historyState.canRedo}
                    canUndo={historyState.canUndo}
                    drawerMode={drawerMode}
                    colorMode={colorMode}
                    selectedTask={selectedTask}
                    zoomIndex={zoomIndex}
                    onAddTaskClick={handleAddTaskClick}
                    onDrawerClose={function closeDrawer() {
                        setIsDrawerOpen(false);
                    }}
                    onSettingsDrawerClose={function closeSettingsDrawer() {
                        setIsSettingsDrawerOpen(false);
                    }}
                    onCreateTask={handleCreateTask}
                    onDeleteSelectedTask={handleDeleteSelectedTask}
                    onEditSelectedTask={handleEditSelectedTask}
                    canEditSelectedTask={canEditSelectedTask}
                    onMoveTasks={handleMoveTasks}
                    onOpenTaskEdit={handleOpenTaskEdit}
                    onRedoTaskChange={handleRedoTaskChange}
                    onResizeTaskDates={handleResizeTaskDates}
                    onClearSelection={function clearSelection() {
                        setSelectedTaskIds([]);
                    }}
                    onSelectTask={handleSelectTask}
                    onUndoTaskChange={handleUndoTaskChange}
                    onUpdateTask={handleUpdateTask}
                    onTimelineZoom={handleTimelineZoom}
                    onColorModeToggle={handleColorModeToggle}
                    onSettingsClick={handleSettingsClick}
                />
                <Snackbar
                    open={Boolean(errorMessage)}
                    autoHideDuration={6000}
                    onClose={closeErrorMessage}
                >
                    <Alert severity="error" variant="filled" onClose={closeErrorMessage}>
                        {errorMessage}
                    </Alert>
                </Snackbar>
            </Box>
        </ThemeProvider>
    );
}


function createPlannerTheme(colorMode) {
    const palette = getCatppuccinPalette(colorMode);

    return createTheme({
        palette: {
            mode: colorMode,
            primary: {
                main: palette.blue,
            },
            secondary: {
                main: palette.mauve,
            },
            error: {
                main: palette.red,
            },
            warning: {
                main: palette.yellow,
            },
            info: {
                main: palette.sky,
            },
            success: {
                main: palette.green,
            },
            background: {
                default: palette.base,
                paper: palette.mantle,
            },
            text: {
                primary: palette.text,
                secondary: palette.subtext0,
            },
            divider: palette.surface0,
        },
        shape: {
            borderRadius: 6,
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        alignItems: "center",
                        lineHeight: BUTTON_LABEL_LINE_HEIGHT,
                    },
                    startIcon: {
                        alignItems: "center",
                        display: "inline-flex",
                    },
                },
            },
            MuiDrawer: {
                styleOverrides: {
                    paper: {
                        backgroundImage: "none",
                    },
                },
            },
        },
    });
}


function getCatppuccinPalette(colorMode) {
    if (colorMode === DARK_COLOR_MODE) {
        return CATPPUCCIN_MACCHIATO;
    }

    return CATPPUCCIN_LATTE;
}


function getInitialColorMode() {
    const storedColorMode = readStoredColorMode();

    if (storedColorMode) {
        return storedColorMode;
    }

    return LIGHT_COLOR_MODE;
}


function readStoredColorMode() {
    try {
        const storedColorMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);

        if (isSupportedColorMode(storedColorMode)) {
            return storedColorMode;
        }
    } catch {
        return null;
    }

    return null;
}


function saveColorMode(colorMode) {
    try {
        window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode);
    } catch {
        return;
    }
}


function isSupportedColorMode(colorMode) {
    return colorMode === LIGHT_COLOR_MODE || colorMode === DARK_COLOR_MODE;
}


function getNextColorMode(colorMode) {
    if (colorMode === DARK_COLOR_MODE) {
        return LIGHT_COLOR_MODE;
    }

    return DARK_COLOR_MODE;
}


function shouldUndoTasks(event, isDrawerOpen) {
    if (isDrawerOpen || !isUndoKeyboardShortcut(event)) {
        return false;
    }

    return !isEditableTarget(event.target);
}


function shouldRedoTasks(event, isDrawerOpen) {
    if (isDrawerOpen || !isRedoKeyboardShortcut(event)) {
        return false;
    }

    return !isEditableTarget(event.target);
}


function isUndoKeyboardShortcut(event) {
    return (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z";
}


function isRedoKeyboardShortcut(event) {
    if (!(event.ctrlKey || event.metaKey)) {
        return false;
    }

    return event.key.toLowerCase() === "y"
        || (event.shiftKey && event.key.toLowerCase() === "z");
}


function shouldDeleteSelectedTasks(event, isDrawerOpen, selectedTaskIds) {
    if (event.key !== "Delete") {
        return false;
    }

    if (event.repeat || isDrawerOpen || selectedTaskIds.length === 0) {
        return false;
    }

    return !isEditableTarget(event.target);
}


function isEditableTarget(target) {
    if (!(target instanceof Element)) {
        return false;
    }

    return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}


function createClientTaskId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return `${CLIENT_TASK_ID_PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}


function pushLimitedHistoryEntry(historyStack, historyEntry) {
    historyStack.push(historyEntry);

    if (historyStack.length > HISTORY_LIMIT) {
        historyStack.shift();
    }
}


function cloneTasks(tasks) {
    return tasks.map(function cloneTask(task) {
        return {
            ...task,
        };
    });
}


function hasSameTaskSelection(firstSelectedTaskIds, secondSelectedTaskIds) {
    if (firstSelectedTaskIds.length !== secondSelectedTaskIds.length) {
        return false;
    }

    return firstSelectedTaskIds.every(function matchTaskId(taskId, index) {
        return taskId === secondSelectedTaskIds[index];
    });
}


function getLastSelectedTaskId(selectedTaskIds) {
    if (selectedTaskIds.length === 0) {
        return null;
    }

    return selectedTaskIds[selectedTaskIds.length - 1];
}


function toggleSelectedTaskId(selectedTaskIds, taskId) {
    if (selectedTaskIds.includes(taskId)) {
        return selectedTaskIds.filter(function keepTaskId(selectedTaskId) {
            return selectedTaskId !== taskId;
        });
    }

    return [...selectedTaskIds, taskId];
}


function getMovingTaskIds(tasks, selectedTaskIds, taskId) {
    if (!selectedTaskIds.includes(taskId)) {
        return [taskId];
    }

    return tasks
        .filter(function matchSelectedTask(task) {
            return selectedTaskIds.includes(task.id);
        })
        .map(function mapTaskId(task) {
            return task.id;
        });
}


function moveTasks(tasks, taskIds, sourceTaskId, dayDelta, rowDelta) {
    const shiftedTasks = shiftTasksByDays(tasks, taskIds, dayDelta);

    if (rowDelta === 0) {
        return shiftedTasks;
    }

    return reorderTasksByRowDelta(shiftedTasks, taskIds, sourceTaskId, rowDelta);
}


function shiftTasksByDays(tasks, taskIds, dayDelta) {
    if (dayDelta === 0) {
        return tasks;
    }

    const taskIdSet = new Set(taskIds);

    return tasks.map(function shiftTask(task) {
        if (!taskIdSet.has(task.id)) {
            return task;
        }

        return {
            ...task,
            startDate: addDaysToDateString(task.startDate, dayDelta),
            stopDate: addDaysToDateString(task.stopDate, dayDelta),
        };
    });
}


function reorderTasksByRowDelta(tasks, taskIds, sourceTaskId, rowDelta) {
    const sourceIndex = tasks.findIndex(function matchSourceTask(task) {
        return task.id === sourceTaskId;
    });

    if (sourceIndex < 0) {
        return tasks;
    }

    const movingTaskIds = tasks
        .filter(function matchMovingTask(task) {
            return taskIds.includes(task.id);
        })
        .map(function mapTaskId(task) {
            return task.id;
        });

    const targetIndex = getClampedRowIndex(sourceIndex + rowDelta, tasks.length);

    return reorderTasksToTargetIndex(tasks, movingTaskIds, sourceTaskId, targetIndex);
}


function reorderTasksToTargetIndex(tasks, movingTaskIds, sourceTaskId, targetIndex) {
    const movingTaskIdSet = new Set(movingTaskIds);
    const sourceOffset = Math.max(0, movingTaskIds.indexOf(sourceTaskId));
    const targetTopIndex = getClampedGroupTopIndex(
        targetIndex - sourceOffset,
        tasks.length,
        movingTaskIds.length,
    );
    const movingTasks = tasks.filter(function matchMovingTask(task) {
        return movingTaskIdSet.has(task.id);
    });
    const remainingTasks = tasks.filter(function matchRemainingTask(task) {
        return !movingTaskIdSet.has(task.id);
    });

    return [
        ...remainingTasks.slice(0, targetTopIndex),
        ...movingTasks,
        ...remainingTasks.slice(targetTopIndex),
    ];
}


function getClampedRowIndex(rowIndex, taskCount) {
    return Math.min(Math.max(rowIndex, 0), taskCount - 1);
}


function getClampedGroupTopIndex(rowIndex, taskCount, groupSize) {
    return Math.min(Math.max(rowIndex, 0), taskCount - groupSize);
}


function hasSameTaskList(firstTasks, secondTasks) {
    if (firstTasks.length !== secondTasks.length) {
        return false;
    }

    return firstTasks.every(function matchTask(firstTask, index) {
        const secondTask = secondTasks[index];

        return firstTask.id === secondTask.id && hasSameTaskValues(firstTask, secondTask);
    });
}


function getResizedTask(task, resizeEdge, dayDelta) {
    if (resizeEdge === "start") {
        return {
            ...task,
            startDate: getClampedStartDate(
                addDaysToDateString(task.startDate, dayDelta),
                task.stopDate,
            ),
        };
    }

    return {
        ...task,
        stopDate: getClampedStopDate(
            addDaysToDateString(task.stopDate, dayDelta),
            task.startDate,
        ),
    };
}


function getClampedStartDate(startDate, stopDate) {
    if (startDate > stopDate) {
        return stopDate;
    }

    return startDate;
}


function getClampedStopDate(stopDate, startDate) {
    if (stopDate < startDate) {
        return startDate;
    }

    return stopDate;
}


function insertTaskAfter(tasks, taskToInsert, afterTaskId) {
    if (!afterTaskId) {
        return [...tasks, taskToInsert];
    }

    const selectedTaskIndex = tasks.findIndex(function matchTask(task) {
        return task.id === afterTaskId;
    });

    if (selectedTaskIndex < 0) {
        return [...tasks, taskToInsert];
    }

    return [
        ...tasks.slice(0, selectedTaskIndex + 1),
        taskToInsert,
        ...tasks.slice(selectedTaskIndex + 1),
    ];
}


function replaceTaskById(tasks, updatedTask) {
    return tasks.map(function replaceTask(task) {
        if (task.id === updatedTask.id) {
            return updatedTask;
        }

        return task;
    });
}


function hasSameTaskValues(task, expectedTask) {
    return (
        task.name === expectedTask.name
        && (task.description || "") === (expectedTask.description || "")
        && (task.url || "") === (expectedTask.url || "")
        && (task.assignee || "Unassigned") === (expectedTask.assignee || "Unassigned")
        && task.taskType === expectedTask.taskType
        && (task.taskLevel || "") === (expectedTask.taskLevel || "")
        && task.startDate === expectedTask.startDate
        && task.stopDate === expectedTask.stopDate
        && task.progressPercent === expectedTask.progressPercent
    );
}
