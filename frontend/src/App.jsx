import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, CssBaseline, Snackbar, ThemeProvider, createTheme } from "@mui/material";

import {
    createDayOffs,
    deleteDayOffs,
    listAssignees,
    listDayOffs,
    listProjectNames,
    listTasks,
    replaceAssignees,
    replaceDayOffs,
    replaceProjectNames,
    replaceTasks,
    replaceTasksBeforeUnload,
} from "./api/tasksClient";
import PlannerShell from "./components/PlannerShell";
import {
    DEFAULT_ZOOM_INDEX,
    MAX_ZOOM_INDEX,
    MIN_ZOOM_INDEX,
    addDaysToDateString,
    computeMultiPhaseTaskDates,
    getTimelineZoomIndexForMode,
    getTimelineZoomMode,
} from "./utils/chartScale";
import {
    doesSubTaskOverlap,
    getSubTaskDurationDayDelta,
    hasSubTaskOverlap,
    sortSubTasksByStartDate,
} from "./utils/subTasks";
import {
    DAY_OFF_ALL_ASSIGNEES,
    DEFAULT_TASK_LEVEL,
    MULTI_PHASE_TASK_TYPE,
    RELEASE_TASK_TYPE,
} from "./constants/taskOptions";


const COLOR_MODE_STORAGE_KEY = "planner-color-mode";
const TIMELINE_HORIZONTAL_GRID_LINES_STORAGE_KEY = "planner-timeline-horizontal-grid-lines";
const HISTORY_LIMIT = 30;
const SAVE_ACTION_THRESHOLD = 10;
const SAVE_INTERVAL_MILLISECONDS = 60 * 1000;
const CLIENT_TASK_ID_PREFIX = "task";
const BUTTON_LABEL_LINE_HEIGHT = 1.2;
const LIGHT_COLOR_MODE = "light";
const DARK_COLOR_MODE = "dark";
const STORED_BOOLEAN_TRUE = "true";
const STORED_BOOLEAN_FALSE = "false";
const TASK_BUFFER_MODE_COPY = "copy";
const TASK_BUFFER_MODE_CUT = "cut";

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
    const [
        showTimelineHorizontalGridLines,
        setShowTimelineHorizontalGridLines,
    ] = useState(getInitialTimelineHorizontalGridLines);
    const [tasks, setTasks] = useState([]);
    const [dayOffs, setDayOffs] = useState([]);
    const [assignees, setAssignees] = useState([]);
    const [projectNames, setProjectNames] = useState([]);
    const [selectedTaskIds, setSelectedTaskIds] = useState([]);
    const [selectedDayOffDates, setSelectedDayOffDates] = useState([]);
    const [copiedTasks, setCopiedTasks] = useState([]);
    const [cutTaskIds, setCutTaskIds] = useState([]);
    const [taskBufferMode, setTaskBufferMode] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isDayOffDrawerOpen, setIsDayOffDrawerOpen] = useState(false);
    const [selectedSubTask, setSelectedSubTask] = useState(null);
    const [selectedSubTasks, setSelectedSubTasks] = useState([]);
    const [copiedSubTask, setCopiedSubTask] = useState(null);
    const [cutSubTaskInfo, setCutSubTaskInfo] = useState(null);
    const [subTaskEditRequest, setSubTaskEditRequest] = useState(null);
    const [drawerMode, setDrawerMode] = useState("create");
    const [dayOffDrawerMode, setDayOffDrawerMode] = useState("create");
    const [isLoading, setIsLoading] = useState(true);
    const [isDayOffSaving, setIsDayOffSaving] = useState(false);
    const [isAssigneeSaving, setIsAssigneeSaving] = useState(false);
    const [isProjectSaving, setIsProjectSaving] = useState(false);
    const isSaving = isDayOffSaving || isAssigneeSaving || isProjectSaving;
    const [errorMessage, setErrorMessage] = useState("");
    const [historyState, setHistoryState] = useState({
        canUndo: false,
        canRedo: false,
    });
    const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
    const tasksRef = useRef([]);
    const dayOffsRef = useRef([]);
    const assigneesRef = useRef([]);
    const projectNamesRef = useRef([]);
    const selectedTaskIdsRef = useRef([]);
    const selectedDayOffDatesRef = useRef([]);
    const copiedTasksRef = useRef([]);
    const cutTaskIdsRef = useRef([]);
    const taskBufferModeRef = useRef(null);
    const lastSelectedTaskIdRef = useRef(null);
    const lastSelectedDayOffDateRef = useRef(null);
    const selectedSubTaskRef = useRef(null);
    const selectedSubTasksRef = useRef([]);
    const copiedSubTaskRef = useRef(null);
    const cutSubTaskInfoRef = useRef(null);
    const subTaskEditRequestIdRef = useRef(0);
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);
    const isDirtyRef = useRef(false);
    const pendingActionCountRef = useRef(0);
    const isSavingRef = useRef(false);

    const theme = useMemo(function createThemeForColorMode() {
        return createPlannerTheme(colorMode);
    }, [colorMode]);
    const dayOffDrawerInitialValues = useMemo(function createDayOffDrawerInitialValues() {
        return getDayOffDrawerInitialValues(dayOffs, selectedDayOffDates);
    }, [dayOffs, selectedDayOffDates]);

    useEffect(function syncDocumentColorMode() {
        document.documentElement.dataset.colorMode = colorMode;
    }, [colorMode]);

    useEffect(function loadInitialPlannerData() {
        loadPlannerData();
    }, []);

    useEffect(function keepLatestTasksReference() {
        tasksRef.current = tasks;
    }, [tasks]);

    useEffect(function keepLatestDayOffsReference() {
        dayOffsRef.current = dayOffs;
    }, [dayOffs]);

    useEffect(function keepLatestAssigneesReference() {
        assigneesRef.current = assignees;
    }, [assignees]);

    useEffect(function keepLatestProjectNamesReference() {
        projectNamesRef.current = projectNames;
    }, [projectNames]);

    useEffect(function keepLatestSelectionReference() {
        selectedTaskIdsRef.current = selectedTaskIds;
    }, [selectedTaskIds]);

    useEffect(function keepLatestDayOffSelectionReference() {
        selectedDayOffDatesRef.current = selectedDayOffDates;
    }, [selectedDayOffDates]);

    useEffect(function keepLatestCopiedTasksReference() {
        copiedTasksRef.current = copiedTasks;
    }, [copiedTasks]);

    useEffect(function keepLatestCutTaskIdsReference() {
        cutTaskIdsRef.current = cutTaskIds;
    }, [cutTaskIds]);

    useEffect(function keepLatestTaskBufferModeReference() {
        taskBufferModeRef.current = taskBufferMode;
    }, [taskBufferMode]);

    useEffect(function keepLatestSelectedSubTaskReference() {
        selectedSubTaskRef.current = selectedSubTask;
    }, [selectedSubTask]);

    useEffect(function keepLatestSelectedSubTasksReference() {
        selectedSubTasksRef.current = selectedSubTasks;
    }, [selectedSubTasks]);

    useEffect(function keepLatestCopiedSubTaskReference() {
        copiedSubTaskRef.current = copiedSubTask;
    }, [copiedSubTask]);

    useEffect(function keepLatestCutSubTaskInfoReference() {
        cutSubTaskInfoRef.current = cutSubTaskInfo;
    }, [cutSubTaskInfo]);

    useEffect(function pruneMissingCutTaskIds() {
        if (
            taskBufferModeRef.current !== TASK_BUFFER_MODE_CUT
            || cutTaskIdsRef.current.length === 0
        ) {
            return;
        }

        const taskIdSet = new Set(tasks.map(function mapTaskId(task) {
            return task.id;
        }));
        const existingCutTaskIds = cutTaskIdsRef.current.filter(
            function keepExistingCutTaskId(taskId) {
                return taskIdSet.has(taskId);
            },
        );

        if (existingCutTaskIds.length === cutTaskIdsRef.current.length) {
            return;
        }

        cutTaskIdsRef.current = existingCutTaskIds;
        setCutTaskIds(existingCutTaskIds);

        if (existingCutTaskIds.length > 0) {
            return;
        }

        taskBufferModeRef.current = null;
        setTaskBufferMode(null);
    }, [tasks]);

    useEffect(function pruneMissingSubTaskState() {
        if (selectedSubTasksRef.current.length > 0) {
            const existingSelectedSubTasks = selectedSubTasksRef.current.filter(
                function keepExistingSelectedSubTask(subTaskInfo) {
                    return hasSubTaskInTasks(tasks, subTaskInfo);
                },
            );

            if (existingSelectedSubTasks.length !== selectedSubTasksRef.current.length) {
                const nextSelectedSubTask = getLastSelectedSubTask(existingSelectedSubTasks);

                selectedSubTasksRef.current = existingSelectedSubTasks;
                selectedSubTaskRef.current = nextSelectedSubTask;
                setSelectedSubTasks(existingSelectedSubTasks);
                setSelectedSubTask(nextSelectedSubTask);
            }
        }

        if (
            copiedSubTaskRef.current
            && !hasSubTaskInTasks(tasks, copiedSubTaskRef.current)
        ) {
            copiedSubTaskRef.current = null;
            setCopiedSubTask(null);
        }

        if (
            cutSubTaskInfoRef.current
            && !hasSubTaskIdInTasks(
                tasks,
                cutSubTaskInfoRef.current.parentTaskId,
                cutSubTaskInfoRef.current.subTaskId,
            )
        ) {
            cutSubTaskInfoRef.current = null;
            setCutSubTaskInfo(null);
        }
    }, [tasks]);

    useEffect(function bindTaskKeyboardShortcuts() {
        function handleGlobalKeyDown(event) {
            const isAnyDrawerOpen = (
                isDrawerOpen
                || isDayOffDrawerOpen
            );
            const currentSelectedTaskIds = selectedTaskIdsRef.current;
            const currentCopiedTasks = copiedTasksRef.current;
            const currentCutTaskIds = cutTaskIdsRef.current;
            const currentTaskBufferMode = taskBufferModeRef.current;
            const currentSelectedSubTask = selectedSubTaskRef.current;
            const currentCutSubTaskInfo = cutSubTaskInfoRef.current;

            if (shouldUndoTasks(event, isAnyDrawerOpen)) {
                event.preventDefault();
                void handleUndoTaskChange();
                return;
            }

            if (shouldRedoTasks(event, isAnyDrawerOpen)) {
                event.preventDefault();
                void handleRedoTaskChange();
                return;
            }

            // Route keyboard shortcuts for sub-task clipboard when a sub-task is selected
            if (currentSelectedSubTask && !isAnyDrawerOpen && !isEditableTarget(event.target)) {
                if (isCutKeyboardShortcut(event)) {
                    event.preventDefault();
                    handleCutSubTask(
                        currentSelectedSubTask.parentTaskId,
                        currentSelectedSubTask.subTask.id,
                    );

                    return;
                }

                if (isCopyKeyboardShortcut(event)) {
                    event.preventDefault();
                    handleCopySubTask(
                        currentSelectedSubTask.parentTaskId,
                        currentSelectedSubTask.subTask,
                    );

                    return;
                }

                if (isPasteKeyboardShortcut(event) && (copiedSubTaskRef.current || cutSubTaskInfoRef.current)) {
                    event.preventDefault();
                    handlePasteSubTask(currentSelectedSubTask.parentTaskId);

                    return;
                }
            }

            if (shouldCutSelectedTasks(event, isAnyDrawerOpen, currentSelectedTaskIds)) {
                event.preventDefault();
                handleCutSelectedTasks();
                return;
            }

            if (shouldCancelCutTasks(event, isAnyDrawerOpen, currentTaskBufferMode)) {
                event.preventDefault();
                clearCutTaskBuffer();
                return;
            }

            if (shouldCancelCutSubTask(event, isAnyDrawerOpen, currentCutSubTaskInfo)) {
                event.preventDefault();
                clearCutSubTaskBuffer();
                return;
            }

            if (shouldCopySelectedTasks(event, isAnyDrawerOpen, currentSelectedTaskIds)) {
                event.preventDefault();
                handleCopySelectedTasks();
                return;
            }

            if (
                shouldPasteBufferedTasks(
                    event,
                    isAnyDrawerOpen,
                    currentTaskBufferMode,
                    currentCopiedTasks,
                    currentCutTaskIds,
                )
            ) {
                event.preventDefault();
                handlePasteBufferedTasks();
                return;
            }

            if (!shouldDeleteSelectedTasks(event, isAnyDrawerOpen, currentSelectedTaskIds)) {
                return;
            }

            event.preventDefault();
            handleDeleteSelectedTask();
        }

        window.addEventListener("keydown", handleGlobalKeyDown);

        return function removeTaskKeyboardShortcuts() {
            window.removeEventListener("keydown", handleGlobalKeyDown);
        };
    }, [
        isDayOffDrawerOpen,
        isDrawerOpen,
    ]);

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

    async function loadPlannerData() {
        setIsLoading(true);

        try {
            const [
                tasksResult,
                dayOffsResult,
                assigneesResult,
                projectNamesResult,
            ] = await Promise.allSettled([
                listTasks(),
                listDayOffs(),
                listAssignees(),
                listProjectNames(),
            ]);

            if (tasksResult.status === "rejected") {
                throw tasksResult.reason;
            }

            const loadedTasks = tasksResult.value;

            tasksRef.current = loadedTasks;
            setTasks(loadedTasks);
            clearMissingSelection(loadedTasks);

            if (dayOffsResult.status === "fulfilled") {
                const loadedDayOffs = dayOffsResult.value;

                dayOffsRef.current = loadedDayOffs;
                setDayOffs(loadedDayOffs);
            } else {
                dayOffsRef.current = [];
                setDayOffs([]);
                setErrorMessage(getDayOffLoadErrorMessage(dayOffsResult.reason));
            }

            if (assigneesResult.status === "fulfilled") {
                const loadedAssignees = assigneesResult.value;

                assigneesRef.current = loadedAssignees;
                setAssignees(loadedAssignees);
            } else {
                assigneesRef.current = [];
                setAssignees([]);
                setErrorMessage(getAssigneeLoadErrorMessage(assigneesResult.reason));
            }

            if (projectNamesResult.status === "fulfilled") {
                const loadedProjectNames = projectNamesResult.value;

                projectNamesRef.current = loadedProjectNames;
                setProjectNames(loadedProjectNames);
            } else {
                projectNamesRef.current = [];
                setProjectNames([]);
                setErrorMessage(getProjectNamesLoadErrorMessage(projectNamesResult.reason));
            }
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
        setSubTaskEditRequest(null);
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
            setSubTaskEditRequest(null);
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
        setSubTaskEditRequest(null);
        setIsDrawerOpen(false);

        return true;
    }

    async function handleUpdateTasks(taskPatch) {
        const beforeTasks = tasksRef.current;
        const beforeSelectedTaskIds = selectedTaskIdsRef.current;

        if (beforeSelectedTaskIds.length === 0) {
            return false;
        }

        if (Object.keys(taskPatch).length === 0) {
            setSubTaskEditRequest(null);
            setIsDrawerOpen(false);
            return true;
        }

        const selectedTaskIdSet = new Set(beforeSelectedTaskIds);
        const afterTasks = beforeTasks.map(function updateSelectedTask(task) {
            if (!selectedTaskIdSet.has(task.id)) {
                return task;
            }

            return applyBulkTaskPatch(task, taskPatch);
        });

        if (hasSameTaskList(beforeTasks, afterTasks)) {
            setSubTaskEditRequest(null);
            setIsDrawerOpen(false);
            return true;
        }

        commitTaskChange(
            beforeTasks,
            afterTasks,
            beforeSelectedTaskIds,
            beforeSelectedTaskIds,
            "Edit tasks",
        );
        setSubTaskEditRequest(null);
        setIsDrawerOpen(false);

        return true;
    }

    async function handleMoveTasks(taskId, dayDelta, rowDelta, subTaskId = null) {
        if (dayDelta === 0 && rowDelta === 0) {
            return;
        }

        const beforeTasks = tasksRef.current;
        const beforeSelectedTaskIds = selectedTaskIdsRef.current;

        if (subTaskId) {
            const parentTask = beforeTasks.find(function matchTask(task) {
                return task.id === taskId;
            });

            if (!parentTask || !parentTask.subTasks) {
                return;
            }

            const movedSubTasks = sortSubTasksByStartDate(parentTask.subTasks.map(
                function shiftSubTask(st) {
                    if (st.id !== subTaskId) {
                        return st;
                    }

                    return {
                        ...st,
                        startDate: addDaysToDateString(st.startDate, dayDelta),
                        stopDate: addDaysToDateString(st.stopDate, dayDelta),
                    };
                },
            ));

            if (hasSubTaskOverlap(movedSubTasks)) {
                return;
            }

            const computed = computeMultiPhaseTaskDates(movedSubTasks);
            const updatedTask = { ...parentTask, subTasks: movedSubTasks, ...computed };
            const afterTasks = replaceTaskById(beforeTasks, updatedTask);

            commitTaskChange(
                beforeTasks,
                afterTasks,
                beforeSelectedTaskIds,
                [taskId],
                "Move sub-task",
            );

            const movedSubTask = movedSubTasks.find(function matchMovedSubTask(subTask) {
                return subTask.id === subTaskId;
            });

            if (movedSubTask) {
                handleSelectSubTask({
                    parentTaskId: taskId,
                    subTask: movedSubTask,
                });
            }

            return;
        }

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

    async function handleResizeTaskDates(taskId, resizeEdge, dayDelta, subTaskId = null) {
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

        if (subTaskId) {
            const resizedSubTasks = sortSubTasksByStartDate((task.subTasks || []).map(
                function resizeSubTask(subTask) {
                    if (subTask.id !== subTaskId) {
                        return subTask;
                    }

                    return getResizedTask(subTask, resizeEdge, dayDelta);
                },
            ));

            if (hasSubTaskOverlap(resizedSubTasks)) {
                return;
            }

            const computed = computeMultiPhaseTaskDates(resizedSubTasks);
            const optimisticTask = {
                ...task,
                subTasks: resizedSubTasks,
                ...computed,
            };

            if (hasSameTaskValues(task, optimisticTask)) {
                return;
            }

            const afterTasks = replaceTaskById(beforeTasks, optimisticTask);

            commitTaskChange(
                beforeTasks,
                afterTasks,
                beforeSelectedTaskIds,
                [task.id],
                "Resize sub-task",
            );

            const resizedSubTask = resizedSubTasks.find(function matchResizedSubTask(subTask) {
                return subTask.id === subTaskId;
            });

            if (resizedSubTask) {
                handleSelectSubTask({
                    parentTaskId: taskId,
                    subTask: resizedSubTask,
                });
            }

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
        const beforeSelectedSubTasks = selectedSubTasksRef.current;

        if (beforeSelectedSubTasks.length > 0) {
            deleteSelectedSubTasks(beforeTasks, beforeSelectedTaskIds, beforeSelectedSubTasks);
            return;
        }

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
        clearSubTaskSelection();
    }

    function deleteSelectedSubTasks(beforeTasks, beforeSelectedTaskIds, beforeSelectedSubTasks) {
        const selectedSubTaskIdsByParent = getSelectedSubTaskIdsByParent(beforeSelectedSubTasks);
        const shouldClearCutSubTask = isCutSubTaskSelected(
            cutSubTaskInfoRef.current,
            selectedSubTaskIdsByParent,
        );
        const afterTasks = beforeTasks.map(function deleteSubTasksFromTask(task) {
            const selectedSubTaskIds = selectedSubTaskIdsByParent.get(task.id);

            if (!selectedSubTaskIds || !task.subTasks) {
                return task;
            }

            const remainingSubTasks = sortSubTasksByStartDate(task.subTasks.filter(
                function keepUnselectedSubTask(subTask) {
                    return !selectedSubTaskIds.has(subTask.id);
                },
            ));
            const computed = computeMultiPhaseTaskDates(remainingSubTasks);

            return {
                ...task,
                subTasks: remainingSubTasks,
                ...computed,
            };
        });

        if (hasSameTaskList(beforeTasks, afterTasks)) {
            clearSubTaskSelection();
            if (shouldClearCutSubTask) {
                clearCutSubTaskBuffer();
            }
            return;
        }

        commitTaskChange(
            beforeTasks,
            afterTasks,
            beforeSelectedTaskIds,
            beforeSelectedTaskIds,
            getDeleteSubTaskHistoryLabel(beforeSelectedSubTasks),
        );
        clearSubTaskSelection();

        if (shouldClearCutSubTask) {
            clearCutSubTaskBuffer();
        }
    }

    function handleCopySelectedTasks() {
        const beforeTasks = tasksRef.current;
        const beforeSelectedTaskIds = selectedTaskIdsRef.current;

        if (beforeSelectedTaskIds.length === 0) {
            return;
        }

        const selectedTasks = getTasksByIdsInTaskOrder(beforeTasks, beforeSelectedTaskIds);

        if (selectedTasks.length === 0) {
            return;
        }

        const copiedTaskSnapshots = cloneTasks(selectedTasks);

        copiedTasksRef.current = copiedTaskSnapshots;
        cutTaskIdsRef.current = [];
        taskBufferModeRef.current = TASK_BUFFER_MODE_COPY;
        setCopiedTasks(copiedTaskSnapshots);
        setCutTaskIds([]);
        setTaskBufferMode(TASK_BUFFER_MODE_COPY);
    }

    function handleCutSelectedTasks() {
        const beforeTasks = tasksRef.current;
        const beforeSelectedTaskIds = selectedTaskIdsRef.current;

        if (beforeSelectedTaskIds.length === 0) {
            return;
        }

        const nextCutTaskIds = getTaskIdsByIdsInTaskOrder(beforeTasks, beforeSelectedTaskIds);

        if (nextCutTaskIds.length === 0) {
            return;
        }

        copiedTasksRef.current = [];
        cutTaskIdsRef.current = nextCutTaskIds;
        taskBufferModeRef.current = TASK_BUFFER_MODE_CUT;
        setCopiedTasks([]);
        setCutTaskIds(nextCutTaskIds);
        setTaskBufferMode(TASK_BUFFER_MODE_CUT);
    }

    function handleSelectSubTask(subTaskInfo, selectionMode = getDefaultSelectionMode()) {
        if (!subTaskInfo) {
            clearSubTaskSelection();
            return;
        }

        const nextSelectedSubTasks = getNextSelectedSubTasks(
            selectedSubTasksRef.current,
            subTaskInfo,
            selectionMode,
        );
        const nextSelectedSubTask = getLastSelectedSubTask(nextSelectedSubTasks);

        selectedSubTasksRef.current = nextSelectedSubTasks;
        selectedSubTaskRef.current = nextSelectedSubTask;
        setSelectedSubTasks(nextSelectedSubTasks);
        setSelectedSubTask(nextSelectedSubTask);
    }

    function clearSubTaskSelection() {
        selectedSubTasksRef.current = [];
        selectedSubTaskRef.current = null;
        setSelectedSubTasks([]);
        setSelectedSubTask(null);
    }

    function handleCopySubTask(parentTaskId, subTask) {
        clearTaskClipboard();
        copiedSubTaskRef.current = { parentTaskId, subTask };
        cutSubTaskInfoRef.current = null;
        setCopiedSubTask({ parentTaskId, subTask });
        setCutSubTaskInfo(null);
    }

    function handleCutSubTask(parentTaskId, subTaskId) {
        const info = { parentTaskId, subTaskId };

        clearTaskClipboard();
        cutSubTaskInfoRef.current = info;
        copiedSubTaskRef.current = null;
        setCutSubTaskInfo(info);
        setCopiedSubTask(null);
    }

    function handlePasteSubTask(targetParentTaskId) {
        const beforeTasks = tasksRef.current;
        const beforeSelectedTaskIds = selectedTaskIdsRef.current;
        const selectedDates = selectedDayOffDatesRef.current;
        const targetDate = selectedDates.length > 0
            ? selectedDates[selectedDates.length - 1]
            : null;

        if (!targetDate) {
            return;
        }

        const isCut = Boolean(cutSubTaskInfoRef.current);
        const sourceParentTaskId = isCut
            ? cutSubTaskInfoRef.current.parentTaskId
            : copiedSubTaskRef.current?.parentTaskId;

        if (sourceParentTaskId !== targetParentTaskId) {
            return;
        }

        const subTaskToCopy = isCut
            ? (() => {
                const { parentTaskId, subTaskId } = cutSubTaskInfoRef.current;
                const sourceParent = beforeTasks.find(function matchParent(t) {
                    return t.id === parentTaskId;
                });

                return sourceParent?.subTasks?.find(function matchSub(st) {
                    return st.id === subTaskId;
                }) || null;
            })()
            : copiedSubTaskRef.current?.subTask;

        if (!subTaskToCopy) {
            return;
        }

        const parentTask = beforeTasks.find(function matchParentTask(task) {
            return task.id === targetParentTaskId;
        });

        if (!parentTask || !parentTask.subTasks) {
            return;
        }

        const isReleaseSubTask = subTaskToCopy.taskType === RELEASE_TASK_TYPE;
        const durationDays = getSubTaskDurationDayDelta(subTaskToCopy);
        const newStartDate = targetDate;
        const newStopDate = isReleaseSubTask
            ? targetDate
            : addDaysToDateString(targetDate, durationDays);

        const newSubTask = {
            ...subTaskToCopy,
            id: isCut ? subTaskToCopy.id : createClientTaskId(),
            startDate: newStartDate,
            stopDate: newStopDate,
        };

        const excludeId = isCut ? cutSubTaskInfoRef.current.subTaskId : null;
        const existingSubTasks = isCut && cutSubTaskInfoRef.current.parentTaskId === targetParentTaskId
            ? parentTask.subTasks.filter(function excludeCut(st) {
                return st.id !== excludeId;
            })
            : parentTask.subTasks;

        if (doesSubTaskOverlap(existingSubTasks, newSubTask)) {
            return;
        }

        const newSubTasks = sortSubTasksByStartDate([...existingSubTasks, newSubTask]);
        const computed = computeMultiPhaseTaskDates(newSubTasks);
        const updatedParent = { ...parentTask, subTasks: newSubTasks, ...computed };
        let afterTasks = replaceTaskById(beforeTasks, updatedParent);

        if (isCut) {
            const cutInfo = cutSubTaskInfoRef.current;

            if (cutInfo.parentTaskId !== targetParentTaskId) {
                const sourceParent = afterTasks.find(function matchSource(t) {
                    return t.id === cutInfo.parentTaskId;
                });

                if (sourceParent) {
                    const remainingSubTasks = (sourceParent.subTasks || []).filter(
                        function removeCut(st) {
                            return st.id !== cutInfo.subTaskId;
                        },
                    );
                    const sourceComputed = computeMultiPhaseTaskDates(remainingSubTasks);
                    const updatedSource = {
                        ...sourceParent,
                        subTasks: remainingSubTasks,
                        ...sourceComputed,
                    };
                    afterTasks = replaceTaskById(afterTasks, updatedSource);
                }
            }

            cutSubTaskInfoRef.current = null;
            copiedSubTaskRef.current = null;
            setCutSubTaskInfo(null);
            setCopiedSubTask(null);
        }

        commitTaskChange(
            beforeTasks,
            afterTasks,
            beforeSelectedTaskIds,
            [targetParentTaskId],
            isCut ? "Move sub-task" : "Paste sub-task",
        );
    }

    function clearCutTaskBuffer() {
        if (taskBufferModeRef.current !== TASK_BUFFER_MODE_CUT) {
            return;
        }

        cutTaskIdsRef.current = [];
        taskBufferModeRef.current = null;
        setCutTaskIds([]);
        setTaskBufferMode(null);
    }

    function clearCutSubTaskBuffer() {
        if (!cutSubTaskInfoRef.current) {
            return;
        }

        cutSubTaskInfoRef.current = null;
        setCutSubTaskInfo(null);
    }

    function clearTaskClipboard() {
        copiedTasksRef.current = [];
        cutTaskIdsRef.current = [];
        taskBufferModeRef.current = null;
        setCopiedTasks([]);
        setCutTaskIds([]);
        setTaskBufferMode(null);
    }

    function handlePasteBufferedTasks() {
        if (taskBufferModeRef.current === TASK_BUFFER_MODE_CUT) {
            handlePasteCutTasks();
            return;
        }

        handlePasteCopiedTasks();
    }

    function handlePasteCopiedTasks() {
        const beforeTasks = tasksRef.current;
        const beforeSelectedTaskIds = selectedTaskIdsRef.current;
        const pastedTasks = cloneTasksWithNewIds(copiedTasksRef.current);

        if (pastedTasks.length === 0) {
            return;
        }

        const afterTaskId = getLowestSelectedTaskId(beforeTasks, beforeSelectedTaskIds);
        const afterTasks = insertTasksAfter(beforeTasks, pastedTasks, afterTaskId);

        commitTaskChange(
            beforeTasks,
            afterTasks,
            beforeSelectedTaskIds,
            beforeSelectedTaskIds,
            "Paste task",
        );
    }

    function handlePasteCutTasks() {
        const beforeTasks = tasksRef.current;
        const beforeSelectedTaskIds = selectedTaskIdsRef.current;
        const currentCutTaskIds = getTaskIdsByIdsInTaskOrder(beforeTasks, cutTaskIdsRef.current);

        if (currentCutTaskIds.length === 0) {
            clearCutTaskBuffer();
            return;
        }

        const afterTaskId = getLowestNonCutSelectedTaskId(
            beforeTasks,
            beforeSelectedTaskIds,
            currentCutTaskIds,
        );

        if (!afterTaskId) {
            return;
        }

        const afterTasks = moveTasksAfterTask(beforeTasks, currentCutTaskIds, afterTaskId);

        cutTaskIdsRef.current = [];
        taskBufferModeRef.current = null;
        setCutTaskIds([]);
        setTaskBufferMode(null);

        commitTaskChange(
            beforeTasks,
            afterTasks,
            currentCutTaskIds,
            currentCutTaskIds,
            "Move task",
        );
    }

    function handleAddTaskClick() {
        setSubTaskEditRequest(null);
        setDrawerMode("create");
        setIsDrawerOpen(true);
    }

    function handleDayOffActionClick() {
        if (selectedDayOffDates.length === 0) {
            return;
        }

        if (hasDayOffForSelectedDates(dayOffs, selectedDayOffDates)) {
            void handleRemoveSelectedDayOffs();
            return;
        }

        setDayOffDrawerMode("create");
        setIsDayOffDrawerOpen(true);
    }

    async function handleCreateDayOffs(dayOffDraft) {
        const beforeDayOffs = dayOffsRef.current;
        const beforeSelectedDayOffDates = selectedDayOffDatesRef.current;
        const historyLabel = getDayOffHistoryLabel(dayOffDrawerMode);

        setIsDayOffSaving(true);

        try {
            const updatedDayOffs = await createDayOffs(dayOffDraft);

            commitDayOffChange(
                beforeDayOffs,
                updatedDayOffs,
                beforeSelectedDayOffDates,
                beforeSelectedDayOffDates,
                historyLabel,
            );
            setIsDayOffDrawerOpen(false);

            return true;
        } catch (error) {
            setErrorMessage(error.message);

            return false;
        } finally {
            setIsDayOffSaving(false);
        }
    }

    async function handleRemoveSelectedDayOffs() {
        if (selectedDayOffDates.length === 0) {
            return;
        }

        const beforeDayOffs = dayOffsRef.current;
        const beforeSelectedDayOffDates = selectedDayOffDatesRef.current;

        setIsDayOffSaving(true);

        try {
            const updatedDayOffs = await deleteDayOffs(selectedDayOffDates);

            commitDayOffChange(
                beforeDayOffs,
                updatedDayOffs,
                beforeSelectedDayOffDates,
                beforeSelectedDayOffDates,
                "Remove day-off",
            );
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setIsDayOffSaving(false);
        }
    }

    async function handleSaveAssignees(assigneeUpdate) {
        if (isDirtyRef.current) {
            await flushTasksToBackend();
        }

        if (isDirtyRef.current) {
            return null;
        }

        setIsAssigneeSaving(true);

        try {
            const updatedPlannerData = await replaceAssignees(assigneeUpdate);

            applyPlannerData(updatedPlannerData);

            return updatedPlannerData;
        } catch (error) {
            setErrorMessage(error.message);

            return null;
        } finally {
            setIsAssigneeSaving(false);
        }
    }

    async function handleSaveProjectNames(projectUpdate) {
        if (isDirtyRef.current) {
            await flushTasksToBackend();
        }

        if (isDirtyRef.current) {
            return null;
        }

        setIsProjectSaving(true);

        try {
            const updatedPlannerData = await replaceProjectNames(projectUpdate);

            applyPlannerData(updatedPlannerData);

            return updatedPlannerData;
        } catch (error) {
            setErrorMessage(error.message);

            return null;
        } finally {
            setIsProjectSaving(false);
        }
    }

    function handleSelectDayOffDate(date, selectionMode) {
        setSelectedDayOffDates(function updateSelectedDayOffDates(currentDates) {
            const nextDates = getNextSelectedDayOffDates(
                currentDates,
                date,
                selectionMode,
                lastSelectedDayOffDateRef.current,
            );

            if (!selectionMode.isRangeSelect) {
                lastSelectedDayOffDateRef.current = date;
            }

            selectedDayOffDatesRef.current = nextDates;

            return nextDates;
        });
    }

    function handleDayOffDrawerClose() {
        setIsDayOffDrawerOpen(false);
    }

    function handleOpenDayOffEdit(date) {
        const currentSelectedDates = selectedDayOffDatesRef.current;
        const nextSelectedDates = getDayOffEditSelectedDates(currentSelectedDates, date);

        lastSelectedDayOffDateRef.current = date;
        selectedDayOffDatesRef.current = nextSelectedDates;
        setSelectedDayOffDates(nextSelectedDates);
        setDayOffDrawerMode("edit");
        setIsDayOffDrawerOpen(true);
    }

    function handleEditSelectedTask() {
        if (selectedTaskIds.length === 0) {
            return;
        }

        setSubTaskEditRequest(null);
        setDrawerMode("edit");
        setIsDrawerOpen(true);
    }

    function getNextSubTaskEditRequest(taskId, subTaskId) {
        if (!subTaskId) {
            return null;
        }

        subTaskEditRequestIdRef.current += 1;

        return {
            requestId: subTaskEditRequestIdRef.current,
            taskId,
            subTaskId,
        };
    }

    function handleOpenTaskEdit(taskId, subTaskId = null) {
        lastSelectedTaskIdRef.current = taskId;
        selectedTaskIdsRef.current = [taskId];
        setSelectedTaskIds([taskId]);
        setSubTaskEditRequest(getNextSubTaskEditRequest(taskId, subTaskId));
        setDrawerMode("edit");
        setIsDrawerOpen(true);
    }

    async function handleUndoTaskChange() {
        const historyEntry = undoStackRef.current.pop();

        if (!historyEntry) {
            refreshHistoryState();
            return;
        }

        pushLimitedHistoryEntry(redoStackRef.current, historyEntry);
        applyPlannerSnapshot(
            historyEntry.beforeTasks,
            historyEntry.beforeDayOffs,
            historyEntry.selectedTaskIdsBefore,
            historyEntry.selectedDayOffDatesBefore,
        );

        await persistHistoryUndoRedoChange(historyEntry, "before");
        refreshHistoryState();
    }

    async function handleRedoTaskChange() {
        const historyEntry = redoStackRef.current.pop();

        if (!historyEntry) {
            refreshHistoryState();
            return;
        }

        pushLimitedHistoryEntry(undoStackRef.current, historyEntry);
        applyPlannerSnapshot(
            historyEntry.afterTasks,
            historyEntry.afterDayOffs,
            historyEntry.selectedTaskIdsAfter,
            historyEntry.selectedDayOffDatesAfter,
        );

        await persistHistoryUndoRedoChange(historyEntry, "after");
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
            beforeDayOffs: cloneDayOffs(dayOffsRef.current),
            afterDayOffs: cloneDayOffs(dayOffsRef.current),
            selectedTaskIdsBefore: [...selectedTaskIdsBefore],
            selectedTaskIdsAfter: [...selectedTaskIdsAfter],
            selectedDayOffDatesBefore: [...selectedDayOffDatesRef.current],
            selectedDayOffDatesAfter: [...selectedDayOffDatesRef.current],
            label,
        };

        pushLimitedHistoryEntry(undoStackRef.current, historyEntry);
        redoStackRef.current = [];
        applyPlannerSnapshot(
            afterTasks,
            dayOffsRef.current,
            selectedTaskIdsAfter,
            selectedDayOffDatesRef.current,
        );
        markTasksDirty();
        refreshHistoryState();
    }

    function commitDayOffChange(
        beforeDayOffs,
        afterDayOffs,
        selectedDayOffDatesBefore,
        selectedDayOffDatesAfter,
        label,
    ) {
        if (
            hasSameDayOffList(beforeDayOffs, afterDayOffs)
            && hasSameStringList(selectedDayOffDatesBefore, selectedDayOffDatesAfter)
        ) {
            return;
        }

        const historyEntry = {
            beforeTasks: cloneTasks(tasksRef.current),
            afterTasks: cloneTasks(tasksRef.current),
            beforeDayOffs: cloneDayOffs(beforeDayOffs),
            afterDayOffs: cloneDayOffs(afterDayOffs),
            selectedTaskIdsBefore: [...selectedTaskIdsRef.current],
            selectedTaskIdsAfter: [...selectedTaskIdsRef.current],
            selectedDayOffDatesBefore: [...selectedDayOffDatesBefore],
            selectedDayOffDatesAfter: [...selectedDayOffDatesAfter],
            label,
        };

        pushLimitedHistoryEntry(undoStackRef.current, historyEntry);
        redoStackRef.current = [];
        applyPlannerSnapshot(
            tasksRef.current,
            afterDayOffs,
            selectedTaskIdsRef.current,
            selectedDayOffDatesAfter,
        );
        refreshHistoryState();
    }

    function applyPlannerSnapshot(
        nextTasks,
        nextDayOffs,
        nextSelectedTaskIds,
        nextSelectedDayOffDates,
    ) {
        const clonedTasks = cloneTasks(nextTasks);
        const clonedDayOffs = cloneDayOffs(nextDayOffs);
        const clonedSelectedTaskIds = [...nextSelectedTaskIds];
        const clonedSelectedDayOffDates = [...nextSelectedDayOffDates];

        tasksRef.current = clonedTasks;
        dayOffsRef.current = clonedDayOffs;
        selectedTaskIdsRef.current = clonedSelectedTaskIds;
        selectedDayOffDatesRef.current = clonedSelectedDayOffDates;
        setTasks(clonedTasks);
        setDayOffs(clonedDayOffs);
        setSelectedTaskIds(clonedSelectedTaskIds);
        setSelectedDayOffDates(clonedSelectedDayOffDates);
    }

    function applyPlannerData(plannerData) {
        const nextTasks = cloneTasks(plannerData.tasks);
        const nextDayOffs = cloneDayOffs(plannerData.dayOffs);
        const nextAssignees = cloneAssignees(plannerData.assignees);
        const nextProjectNames = cloneProjectNames(plannerData.project_name || []);

        tasksRef.current = nextTasks;
        dayOffsRef.current = nextDayOffs;
        assigneesRef.current = nextAssignees;
        projectNamesRef.current = nextProjectNames;
        undoStackRef.current = [];
        redoStackRef.current = [];
        isDirtyRef.current = false;
        pendingActionCountRef.current = 0;
        setTasks(nextTasks);
        setDayOffs(nextDayOffs);
        setAssignees(nextAssignees);
        setProjectNames(nextProjectNames);
        clearMissingSelection(nextTasks);
        refreshHistoryState();
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

    async function persistHistoryUndoRedoChange(historyEntry, snapshotKey) {
        if (!hasSameTaskList(historyEntry.beforeTasks, historyEntry.afterTasks)) {
            markTasksDirty();
        }

        if (hasSameDayOffList(historyEntry.beforeDayOffs, historyEntry.afterDayOffs)) {
            return;
        }

        let dayOffsToSave = historyEntry.afterDayOffs;

        if (snapshotKey === "before") {
            dayOffsToSave = historyEntry.beforeDayOffs;
        }

        await persistDayOffsToBackend(dayOffsToSave);
    }

    async function persistDayOffsToBackend(dayOffsToSave) {
        setIsDayOffSaving(true);

        try {
            const updatedDayOffs = await replaceDayOffs(cloneDayOffs(dayOffsToSave));

            dayOffsRef.current = cloneDayOffs(updatedDayOffs);
            setDayOffs(updatedDayOffs);
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setIsDayOffSaving(false);
        }
    }

    function refreshHistoryState() {
        setHistoryState({
            canUndo: undoStackRef.current.length > 0,
            canRedo: redoStackRef.current.length > 0,
        });
    }

    function handleSelectTask(taskId, selectionMode = getDefaultSelectionMode(), taskOrder = []) {
        const taskOrderIds = getTaskOrderIds(taskOrder, tasksRef.current);
        const nextTaskIds = getNextSelectedTaskIds(
            selectedTaskIdsRef.current,
            taskId,
            selectionMode,
            lastSelectedTaskIdRef.current,
            taskOrderIds,
        );

        if (!selectionMode.isRangeSelect) {
            lastSelectedTaskIdRef.current = taskId;
        }

        selectedTaskIdsRef.current = nextTaskIds;
        setSelectedTaskIds(nextTaskIds);
        clearSubTaskSelectionForTaskSelection(nextTaskIds, selectionMode);
    }

    function handleSelectTasks(taskIds, selectionMode = getDefaultSelectionMode(), taskOrder = []) {
        const taskOrderIds = getTaskOrderIds(taskOrder, tasksRef.current);
        const nextTaskIds = getNextBulkSelectedTaskIds(
            selectedTaskIdsRef.current,
            taskIds,
            selectionMode,
            taskOrderIds,
        );

        lastSelectedTaskIdRef.current = getLastSelectedTaskId(nextTaskIds);
        selectedTaskIdsRef.current = nextTaskIds;
        setSelectedTaskIds(nextTaskIds);
        clearSubTaskSelectionForTaskSelection(nextTaskIds, selectionMode);
    }

    function clearSubTaskSelectionForTaskSelection(taskIds, selectionMode) {
        const currentSelectedSubTask = selectedSubTaskRef.current;

        if (!currentSelectedSubTask) {
            return;
        }

        if (!selectionMode.isMultiSelect && !selectionMode.isRangeSelect) {
            clearSubTaskSelection();
            return;
        }

        if (!taskIds.includes(currentSelectedSubTask.parentTaskId)) {
            clearSubTaskSelection();
        }
    }

    function handleTimelineZoom(zoomDirection) {
        setZoomIndex(function updateZoom(currentZoomIndex) {
            const nextZoomIndex = currentZoomIndex + zoomDirection;
            const clampedZoomIndex = Math.min(
                Math.max(nextZoomIndex, MIN_ZOOM_INDEX),
                MAX_ZOOM_INDEX,
            );

            if (clampedZoomIndex === currentZoomIndex) {
                return currentZoomIndex;
            }

            return clampedZoomIndex;
        });
    }

    function handleTimelineZoomModeChange(zoomMode) {
        setZoomIndex(function updateZoomMode(currentZoomIndex) {
            const nextZoomIndex = getTimelineZoomIndexForMode(currentZoomIndex, zoomMode);

            if (nextZoomIndex === currentZoomIndex) {
                return currentZoomIndex;
            }

            return nextZoomIndex;
        });
    }

    function handleColorModeToggle() {
        setColorMode(function toggleColorMode(currentColorMode) {
            const nextColorMode = getNextColorMode(currentColorMode);
            saveColorMode(nextColorMode);

            return nextColorMode;
        });
    }

    function handleTimelineHorizontalGridLinesToggle() {
        setShowTimelineHorizontalGridLines(function toggleGridLines(currentValue) {
            const nextShowTimelineHorizontalGridLines = !currentValue;

            saveTimelineHorizontalGridLines(nextShowTimelineHorizontalGridLines);

            return nextShowTimelineHorizontalGridLines;
        });
    }

    function handleRefreshPlanner() {
        window.location.reload();
    }

    function clearMissingSelection(loadedTasks) {
        setSelectedTaskIds(function clearSelection(currentSelectedTaskIds) {
            const loadedTaskIds = new Set(loadedTasks.map(function mapTaskId(task) {
                return task.id;
            }));

            const nextSelectedTaskIds = currentSelectedTaskIds.filter(function keepTaskId(taskId) {
                return loadedTaskIds.has(taskId);
            });

            if (lastSelectedTaskIdRef.current && !loadedTaskIds.has(lastSelectedTaskIdRef.current)) {
                lastSelectedTaskIdRef.current = null;
            }

            if (
                selectedSubTaskRef.current
                && !loadedTaskIds.has(selectedSubTaskRef.current.parentTaskId)
            ) {
                clearSubTaskSelection();
            }

            selectedTaskIdsRef.current = nextSelectedTaskIds;

            return nextSelectedTaskIds;
        });
    }

    function closeErrorMessage() {
        setErrorMessage("");
    }

    const selectedTaskId = getLastSelectedTaskId(selectedTaskIds);
    const selectedTask = tasks.find(function matchSelectedTask(task) {
        return task.id === selectedTaskId;
    }) || null;
    const selectedTasks = getTasksByIdsInTaskOrder(tasks, selectedTaskIds);
    const canEditSelectedTask = selectedTaskIds.length > 0
        && !hasMixedMultiPhaseAndNormalSelection(tasks, selectedTaskIds);
    const canCopySelectedTasks = selectedTaskIds.length > 0;
    const canCutSelectedTasks = selectedTaskIds.length > 0;
    const canPasteBufferedTasks = canPasteTaskBuffer(taskBufferMode, copiedTasks, cutTaskIds);
    const selectedDatesHaveDayOff = hasDayOffForSelectedDates(dayOffs, selectedDayOffDates);
    const zoomMode = getTimelineZoomMode(zoomIndex);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box className="app-root" data-color-mode={colorMode}>
                <PlannerShell
                    tasks={tasks}
                    dayOffs={dayOffs}
                    assignees={assignees}
                    projectNames={projectNames}
                    selectedTaskId={selectedTaskId}
                    selectedTaskIds={selectedTaskIds}
                    selectedDayOffDates={selectedDayOffDates}
                    isDrawerOpen={isDrawerOpen}
                    isDayOffDrawerOpen={isDayOffDrawerOpen}
                    isLoading={isLoading}
                    isSaving={isSaving}
                    isAssigneeSaving={isAssigneeSaving}
                    isProjectSaving={isProjectSaving}
                    canRedo={historyState.canRedo}
                    canUndo={historyState.canUndo}
                    canCopySelectedTasks={canCopySelectedTasks}
                    canCutSelectedTasks={canCutSelectedTasks}
                    canPasteCopiedTasks={canPasteBufferedTasks}
                    cutTaskIds={cutTaskIds}
                    cutSubTaskInfo={cutSubTaskInfo}
                    selectedSubTasks={selectedSubTasks}
                    drawerMode={drawerMode}
                    dayOffDrawerMode={dayOffDrawerMode}
                    dayOffInitialValues={dayOffDrawerInitialValues}
                    colorMode={colorMode}
                    showTimelineHorizontalGridLines={showTimelineHorizontalGridLines}
                    selectedTask={selectedTask}
                    selectedTasks={selectedTasks}
                    subTaskEditRequest={subTaskEditRequest}
                    zoomIndex={zoomIndex}
                    zoomMode={zoomMode}
                    onAddTaskClick={handleAddTaskClick}
                    onCreateDayOffs={handleCreateDayOffs}
                    onDayOffActionClick={handleDayOffActionClick}
                    onDayOffDrawerClose={handleDayOffDrawerClose}
                    onSaveAssignees={handleSaveAssignees}
                    onSaveProjectNames={handleSaveProjectNames}
                    onTimelineHorizontalGridLinesToggle={
                        handleTimelineHorizontalGridLinesToggle
                    }
                    onDrawerClose={function closeDrawer() {
                        setSubTaskEditRequest(null);
                        setIsDrawerOpen(false);
                    }}
                    onCreateTask={handleCreateTask}
                    onCutSelectedTasks={handleCutSelectedTasks}
                    onCopySelectedTasks={handleCopySelectedTasks}
                    onDeleteSelectedTask={handleDeleteSelectedTask}
                    onEditSelectedTask={handleEditSelectedTask}
                    canEditSelectedTask={canEditSelectedTask}
                    onMoveTasks={handleMoveTasks}
                    onOpenTaskEdit={handleOpenTaskEdit}
                    onOpenDayOffEdit={handleOpenDayOffEdit}
                    onPasteCopiedTasks={handlePasteBufferedTasks}
                    onRefreshPlanner={handleRefreshPlanner}
                    onRedoTaskChange={handleRedoTaskChange}
                    onResizeTaskDates={handleResizeTaskDates}
                    onSubTaskSelect={handleSelectSubTask}
                    onClearSelection={function clearSelection() {
                        lastSelectedTaskIdRef.current = null;
                        lastSelectedDayOffDateRef.current = null;
                        selectedTaskIdsRef.current = [];
                        selectedDayOffDatesRef.current = [];
                        selectedSubTaskRef.current = null;
                        selectedSubTasksRef.current = [];
                        setSelectedTaskIds([]);
                        setSelectedDayOffDates([]);
                        setSelectedSubTask(null);
                        setSelectedSubTasks([]);
                    }}
                    onSelectTask={handleSelectTask}
                    onSelectTasks={handleSelectTasks}
                    onSelectDayOffDate={handleSelectDayOffDate}
                    onUndoTaskChange={handleUndoTaskChange}
                    onUpdateTask={handleUpdateTask}
                    onUpdateTasks={handleUpdateTasks}
                    onTimelineZoom={handleTimelineZoom}
                    onTimelineZoomModeChange={handleTimelineZoomModeChange}
                    onColorModeToggle={handleColorModeToggle}
                    selectedDatesHaveDayOff={selectedDatesHaveDayOff}
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


function getInitialTimelineHorizontalGridLines() {
    const storedTimelineHorizontalGridLines = readStoredTimelineHorizontalGridLines();

    if (storedTimelineHorizontalGridLines === null) {
        return true;
    }

    return storedTimelineHorizontalGridLines;
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


function readStoredTimelineHorizontalGridLines() {
    try {
        const storedValue = window.localStorage.getItem(
            TIMELINE_HORIZONTAL_GRID_LINES_STORAGE_KEY,
        );

        if (storedValue === STORED_BOOLEAN_TRUE) {
            return true;
        }

        if (storedValue === STORED_BOOLEAN_FALSE) {
            return false;
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


function saveTimelineHorizontalGridLines(showTimelineHorizontalGridLines) {
    try {
        const storedValue = showTimelineHorizontalGridLines
            ? STORED_BOOLEAN_TRUE
            : STORED_BOOLEAN_FALSE;

        window.localStorage.setItem(TIMELINE_HORIZONTAL_GRID_LINES_STORAGE_KEY, storedValue);
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


function shouldUndoTasks(event, isAnyDrawerOpen) {
    if (isAnyDrawerOpen || !isUndoKeyboardShortcut(event)) {
        return false;
    }

    return !isEditableTarget(event.target);
}


function shouldRedoTasks(event, isAnyDrawerOpen) {
    if (isAnyDrawerOpen || !isRedoKeyboardShortcut(event)) {
        return false;
    }

    return !isEditableTarget(event.target);
}


function shouldCopySelectedTasks(event, isAnyDrawerOpen, selectedTaskIds) {
    if (event.repeat || isAnyDrawerOpen || selectedTaskIds.length === 0) {
        return false;
    }

    if (!isCopyKeyboardShortcut(event)) {
        return false;
    }

    return !isEditableTarget(event.target);
}


function shouldCutSelectedTasks(event, isAnyDrawerOpen, selectedTaskIds) {
    if (event.repeat || isAnyDrawerOpen || selectedTaskIds.length === 0) {
        return false;
    }

    if (!isCutKeyboardShortcut(event)) {
        return false;
    }

    return !isEditableTarget(event.target);
}


function shouldCancelCutTasks(event, isAnyDrawerOpen, taskBufferMode) {
    if (event.repeat || isAnyDrawerOpen || taskBufferMode !== TASK_BUFFER_MODE_CUT) {
        return false;
    }

    if (event.key !== "Escape") {
        return false;
    }

    return !isEditableTarget(event.target);
}


function shouldCancelCutSubTask(event, isAnyDrawerOpen, cutSubTaskInfo) {
    if (event.repeat || isAnyDrawerOpen || !cutSubTaskInfo) {
        return false;
    }

    if (event.key !== "Escape") {
        return false;
    }

    return !isEditableTarget(event.target);
}


function canPasteTaskBuffer(taskBufferMode, copiedTasks, cutTaskIds) {
    if (taskBufferMode === TASK_BUFFER_MODE_COPY) {
        return copiedTasks.length > 0;
    }

    if (taskBufferMode === TASK_BUFFER_MODE_CUT) {
        return cutTaskIds.length > 0;
    }

    return false;
}


function shouldPasteBufferedTasks(
    event,
    isAnyDrawerOpen,
    taskBufferMode,
    copiedTasks,
    cutTaskIds,
) {
    if (
        event.repeat
        || isAnyDrawerOpen
        || !canPasteTaskBuffer(taskBufferMode, copiedTasks, cutTaskIds)
    ) {
        return false;
    }

    if (!isPasteKeyboardShortcut(event)) {
        return false;
    }

    return !isEditableTarget(event.target);
}


function isUndoKeyboardShortcut(event) {
    const isUndoKey = event.key.toLowerCase() === "z";

    return isPlatformKeyboardShortcut(event) && !event.shiftKey && isUndoKey;
}


function isRedoKeyboardShortcut(event) {
    if (!isPlatformKeyboardShortcut(event)) {
        return false;
    }

    return event.key.toLowerCase() === "y"
        || (event.shiftKey && event.key.toLowerCase() === "z");
}


function isCopyKeyboardShortcut(event) {
    const isCopyKey = event.key.toLowerCase() === "c";

    return isPlatformKeyboardShortcut(event) && !event.shiftKey && isCopyKey;
}


function isCutKeyboardShortcut(event) {
    const isCutKey = event.key.toLowerCase() === "x";

    return isPlatformKeyboardShortcut(event) && !event.shiftKey && isCutKey;
}


function isPasteKeyboardShortcut(event) {
    const isPasteKey = event.key.toLowerCase() === "v";

    return isPlatformKeyboardShortcut(event) && !event.shiftKey && isPasteKey;
}


function isPlatformKeyboardShortcut(event) {
    return event.ctrlKey || event.metaKey;
}


function shouldDeleteSelectedTasks(event, isAnyDrawerOpen, selectedTaskIds) {
    if (event.key !== "Delete") {
        return false;
    }

    if (event.repeat || isAnyDrawerOpen || selectedTaskIds.length === 0) {
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
        const cloned = { ...task };

        if (task.subTasks) {
            cloned.subTasks = task.subTasks.map(function cloneSubTask(st) {
                return { ...st };
            });
        }

        return cloned;
    });
}


function cloneTasksWithNewIds(tasks) {
    return tasks.map(function cloneTaskWithNewId(task) {
        return {
            ...task,
            id: createClientTaskId(),
        };
    });
}


function cloneDayOffs(dayOffs) {
    return dayOffs.map(function cloneDayOff(dayOff) {
        return {
            ...dayOff,
            assignees: [...dayOff.assignees],
        };
    });
}


function cloneAssignees(assignees) {
    return assignees.map(function cloneAssignee(assignee) {
        return {
            ...assignee,
        };
    });
}


function cloneProjectNames(projectNames) {
    return projectNames.map(function cloneProjectName(projectName) {
        return {
            ...projectName,
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


function hasSameStringList(firstValues, secondValues) {
    if (firstValues.length !== secondValues.length) {
        return false;
    }

    return firstValues.every(function matchValue(value, index) {
        return value === secondValues[index];
    });
}


function getLastSelectedTaskId(selectedTaskIds) {
    if (selectedTaskIds.length === 0) {
        return null;
    }

    return selectedTaskIds[selectedTaskIds.length - 1];
}


function getLowestSelectedTaskId(tasks, selectedTaskIds) {
    const selectedTaskIdSet = new Set(selectedTaskIds);
    let lowestSelectedTaskId = null;

    tasks.forEach(function findLowestSelectedTaskId(task) {
        if (selectedTaskIdSet.has(task.id)) {
            lowestSelectedTaskId = task.id;
        }
    });

    return lowestSelectedTaskId;
}


function getLowestNonCutSelectedTaskId(tasks, selectedTaskIds, cutTaskIds) {
    const selectedTaskIdSet = new Set(selectedTaskIds);
    const cutTaskIdSet = new Set(cutTaskIds);
    let lowestSelectedTaskId = null;

    tasks.forEach(function findLowestNonCutSelectedTaskId(task) {
        if (!selectedTaskIdSet.has(task.id) || cutTaskIdSet.has(task.id)) {
            return;
        }

        lowestSelectedTaskId = task.id;
    });

    return lowestSelectedTaskId;
}


function toggleSelectedTaskId(selectedTaskIds, taskId) {
    if (selectedTaskIds.includes(taskId)) {
        return selectedTaskIds.filter(function keepTaskId(selectedTaskId) {
            return selectedTaskId !== taskId;
        });
    }

    return [...selectedTaskIds, taskId];
}


function getDefaultSelectionMode() {
    return {
        isMultiSelect: false,
        isRangeSelect: false,
    };
}


function getNextSelectedTaskIds(
    currentTaskIds,
    taskId,
    selectionMode,
    anchorTaskId,
    taskOrderIds,
) {
    if (selectionMode.isRangeSelect) {
        const rangeTaskIds = getTaskRangeIds(taskOrderIds, anchorTaskId || taskId, taskId);

        if (selectionMode.isMultiSelect) {
            return sortTaskIdsByTaskOrder(
                [...new Set([...currentTaskIds, ...rangeTaskIds])],
                taskOrderIds,
            );
        }

        return rangeTaskIds;
    }

    if (selectionMode.isMultiSelect) {
        return toggleSelectedTaskId(currentTaskIds, taskId);
    }

    return [taskId];
}


function getNextBulkSelectedTaskIds(
    currentTaskIds,
    taskIds,
    selectionMode,
    taskOrderIds,
) {
    if (selectionMode.isMultiSelect) {
        return sortTaskIdsByTaskOrder(
            toggleBulkSelectedTaskIds(currentTaskIds, taskIds),
            taskOrderIds,
        );
    }

    return sortTaskIdsByTaskOrder(taskIds, taskOrderIds);
}


function toggleBulkSelectedTaskIds(currentTaskIds, taskIds) {
    const nextTaskIds = [...currentTaskIds];

    taskIds.forEach(function toggleBulkSelectedTaskId(taskId) {
        const selectedTaskIndex = nextTaskIds.indexOf(taskId);

        if (selectedTaskIndex >= 0) {
            nextTaskIds.splice(selectedTaskIndex, 1);
            return;
        }

        nextTaskIds.push(taskId);
    });

    return nextTaskIds;
}


function getTaskOrderIds(taskOrder, fallbackTasks) {
    const primaryTaskIds = taskOrder.map(function mapTaskOrderId(task) {
        if (typeof task === "string") {
            return task;
        }

        return task.id;
    });

    if (primaryTaskIds.length > 0) {
        return primaryTaskIds;
    }

    return fallbackTasks.map(function mapFallbackTaskId(task) {
        return task.id;
    });
}


function getTaskRangeIds(taskOrderIds, firstTaskId, secondTaskId) {
    const firstTaskIndex = taskOrderIds.indexOf(firstTaskId);
    const secondTaskIndex = taskOrderIds.indexOf(secondTaskId);

    if (firstTaskIndex < 0 || secondTaskIndex < 0) {
        return [secondTaskId];
    }

    const startIndex = Math.min(firstTaskIndex, secondTaskIndex);
    const stopIndex = Math.max(firstTaskIndex, secondTaskIndex);

    return taskOrderIds.slice(startIndex, stopIndex + 1);
}


function sortTaskIdsByTaskOrder(taskIds, taskOrderIds) {
    const taskOrderIndexMap = new Map(taskOrderIds.map(function mapTaskOrderIndex(taskId, index) {
        return [taskId, index];
    }));

    return [...taskIds].sort(function compareTaskOrder(firstTaskId, secondTaskId) {
        const firstTaskIndex = taskOrderIndexMap.get(firstTaskId);
        const secondTaskIndex = taskOrderIndexMap.get(secondTaskId);

        if (firstTaskIndex === undefined || secondTaskIndex === undefined) {
            return taskIds.indexOf(firstTaskId) - taskIds.indexOf(secondTaskId);
        }

        return firstTaskIndex - secondTaskIndex;
    });
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


function getTasksByIdsInTaskOrder(tasks, taskIds) {
    const taskIdSet = new Set(taskIds);

    return tasks.filter(function matchSelectedTask(task) {
        return taskIdSet.has(task.id);
    });
}


function getTaskIdsByIdsInTaskOrder(tasks, taskIds) {
    return getTasksByIdsInTaskOrder(tasks, taskIds)
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

        if (task.taskType === MULTI_PHASE_TASK_TYPE && task.subTasks?.length > 0) {
            const shiftedSubTasks = task.subTasks.map(function shiftSub(st) {
                return {
                    ...st,
                    startDate: addDaysToDateString(st.startDate, dayDelta),
                    stopDate: addDaysToDateString(st.stopDate, dayDelta),
                };
            });
            const computed = computeMultiPhaseTaskDates(shiftedSubTasks);

            return { ...task, subTasks: shiftedSubTasks, ...computed };
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
    return insertTasksAfter(tasks, [taskToInsert], afterTaskId);
}


function insertTasksAfter(tasks, tasksToInsert, afterTaskId) {
    if (tasksToInsert.length === 0) {
        return tasks;
    }

    if (!afterTaskId) {
        return [...tasks, ...tasksToInsert];
    }

    const selectedTaskIndex = tasks.findIndex(function matchTask(task) {
        return task.id === afterTaskId;
    });

    if (selectedTaskIndex < 0) {
        return [...tasks, ...tasksToInsert];
    }

    return [
        ...tasks.slice(0, selectedTaskIndex + 1),
        ...tasksToInsert,
        ...tasks.slice(selectedTaskIndex + 1),
    ];
}


function moveTasksAfterTask(tasks, movingTaskIds, afterTaskId) {
    if (movingTaskIds.length === 0 || !afterTaskId) {
        return tasks;
    }

    const movingTaskIdSet = new Set(movingTaskIds);
    const movingTasks = tasks.filter(function matchMovingTask(task) {
        return movingTaskIdSet.has(task.id);
    });
    const remainingTasks = tasks.filter(function matchRemainingTask(task) {
        return !movingTaskIdSet.has(task.id);
    });

    if (movingTasks.length === 0) {
        return tasks;
    }

    const targetTaskIndex = remainingTasks.findIndex(function matchTargetTask(task) {
        return task.id === afterTaskId;
    });

    if (targetTaskIndex < 0) {
        return tasks;
    }

    return [
        ...remainingTasks.slice(0, targetTaskIndex + 1),
        ...movingTasks,
        ...remainingTasks.slice(targetTaskIndex + 1),
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


function applyBulkTaskPatch(task, taskPatch) {
    const nextTaskType = taskPatch.taskType || task.taskType;
    const updatedTask = {
        ...task,
    };

    Object.entries(taskPatch).forEach(function applyTaskPatchField([fieldName, fieldValue]) {
        if (nextTaskType === RELEASE_TASK_TYPE && fieldName === "stopDate") {
            return;
        }

        if (nextTaskType === RELEASE_TASK_TYPE && fieldName === "progressPercent") {
            return;
        }

        if (nextTaskType === RELEASE_TASK_TYPE && fieldName === "taskLevel") {
            return;
        }

        if (nextTaskType === MULTI_PHASE_TASK_TYPE && fieldName === "startDate") {
            return;
        }

        if (nextTaskType === MULTI_PHASE_TASK_TYPE && fieldName === "stopDate") {
            return;
        }

        if (nextTaskType === MULTI_PHASE_TASK_TYPE && fieldName === "progressPercent") {
            return;
        }

        updatedTask[fieldName] = fieldValue;
    });

    if (nextTaskType === RELEASE_TASK_TYPE) {
        updatedTask.taskType = RELEASE_TASK_TYPE;
        updatedTask.taskLevel = DEFAULT_TASK_LEVEL;
        updatedTask.stopDate = updatedTask.startDate;
        updatedTask.progressPercent = 100;
    }

    return updatedTask;
}


function hasMixedMultiPhaseAndNormalSelection(tasks, selectedTaskIds) {
    if (selectedTaskIds.length <= 1) {
        return false;
    }

    const selectedTaskIdSet = new Set(selectedTaskIds);
    const selectedTasks = tasks.filter(function matchSelected(task) {
        return selectedTaskIdSet.has(task.id);
    });
    const hasMultiPhase = selectedTasks.some(function matchMultiPhase(task) {
        return task.taskType === MULTI_PHASE_TASK_TYPE;
    });
    const hasNonMultiPhase = selectedTasks.some(function matchNonMultiPhase(task) {
        return task.taskType !== MULTI_PHASE_TASK_TYPE;
    });

    return hasMultiPhase && hasNonMultiPhase;
}


function getNextSelectedSubTasks(currentSubTasks, subTaskInfo, selectionMode) {
    if (!selectionMode.isMultiSelect) {
        return [subTaskInfo];
    }

    const selectedSubTaskKey = getSubTaskSelectionKey(subTaskInfo);
    const isAlreadySelected = currentSubTasks.some(function matchSelectedSubTask(
        currentSubTaskInfo,
    ) {
        return getSubTaskSelectionKey(currentSubTaskInfo) === selectedSubTaskKey;
    });

    if (isAlreadySelected) {
        return currentSubTasks.filter(function keepOtherSubTask(currentSubTaskInfo) {
            return getSubTaskSelectionKey(currentSubTaskInfo) !== selectedSubTaskKey;
        });
    }

    return [...currentSubTasks, subTaskInfo];
}


function getLastSelectedSubTask(selectedSubTasks) {
    if (selectedSubTasks.length === 0) {
        return null;
    }

    return selectedSubTasks[selectedSubTasks.length - 1];
}


function getSubTaskSelectionKey(subTaskInfo) {
    return `${subTaskInfo.parentTaskId}:${subTaskInfo.subTask.id}`;
}


function hasSubTaskInTasks(tasks, subTaskInfo) {
    if (!subTaskInfo) {
        return false;
    }

    return hasSubTaskIdInTasks(
        tasks,
        subTaskInfo.parentTaskId,
        subTaskInfo.subTask.id,
    );
}


function hasSubTaskIdInTasks(tasks, parentTaskId, subTaskId) {
    const parentTask = tasks.find(function matchParentTask(task) {
        return task.id === parentTaskId;
    });

    if (!parentTask || !parentTask.subTasks) {
        return false;
    }

    return parentTask.subTasks.some(function matchSubTask(subTask) {
        return subTask.id === subTaskId;
    });
}


function getSelectedSubTaskIdsByParent(selectedSubTasks) {
    const selectedSubTaskIdsByParent = new Map();

    selectedSubTasks.forEach(function groupSelectedSubTask(subTaskInfo) {
        if (!selectedSubTaskIdsByParent.has(subTaskInfo.parentTaskId)) {
            selectedSubTaskIdsByParent.set(subTaskInfo.parentTaskId, new Set());
        }

        selectedSubTaskIdsByParent.get(subTaskInfo.parentTaskId).add(subTaskInfo.subTask.id);
    });

    return selectedSubTaskIdsByParent;
}


function isCutSubTaskSelected(cutSubTaskInfo, selectedSubTaskIdsByParent) {
    if (!cutSubTaskInfo) {
        return false;
    }

    const selectedSubTaskIds = selectedSubTaskIdsByParent.get(cutSubTaskInfo.parentTaskId);

    if (!selectedSubTaskIds) {
        return false;
    }

    return selectedSubTaskIds.has(cutSubTaskInfo.subTaskId);
}


function getDeleteSubTaskHistoryLabel(selectedSubTasks) {
    return selectedSubTasks.length === 1 ? "Delete sub-task" : "Delete sub-tasks";
}


function hasSameSubTasks(aSubTasks, bSubTasks) {
    const aList = aSubTasks || [];
    const bList = bSubTasks || [];

    if (aList.length !== bList.length) {
        return false;
    }

    return aList.every(function matchSubTask(st, i) {
        const bSt = bList[i];

        return (
            st.id === bSt.id
            && st.name === bSt.name
            && st.taskType === bSt.taskType
            && st.startDate === bSt.startDate
            && st.stopDate === bSt.stopDate
            && st.progressPercent === bSt.progressPercent
        );
    });
}


function hasSameTaskValues(task, expectedTask) {
    return (
        task.name === expectedTask.name
        && (task.description || "") === (expectedTask.description || "")
        && (task.url || "") === (expectedTask.url || "")
        && (task.assignee || "Unassigned") === (expectedTask.assignee || "Unassigned")
        && (task.projectName || "...") === (expectedTask.projectName || "...")
        && task.taskType === expectedTask.taskType
        && (task.taskLevel || "") === (expectedTask.taskLevel || "")
        && task.startDate === expectedTask.startDate
        && task.stopDate === expectedTask.stopDate
        && task.progressPercent === expectedTask.progressPercent
        && hasSameSubTasks(task.subTasks, expectedTask.subTasks)
    );
}


function hasSameDayOffList(firstDayOffs, secondDayOffs) {
    if (firstDayOffs.length !== secondDayOffs.length) {
        return false;
    }

    return firstDayOffs.every(function matchDayOff(firstDayOff, index) {
        const secondDayOff = secondDayOffs[index];

        return firstDayOff.id === secondDayOff.id
            && hasSameDayOffValues(firstDayOff, secondDayOff);
    });
}


function hasSameDayOffValues(dayOff, expectedDayOff) {
    return (
        dayOff.date === expectedDayOff.date
        && dayOff.name === expectedDayOff.name
        && (dayOff.description || "") === (expectedDayOff.description || "")
        && hasSameStringList(dayOff.assignees, expectedDayOff.assignees)
    );
}


function getDayOffDrawerInitialValues(dayOffs, selectedDates) {
    const selectedDayOffs = selectedDates.map(function mapSelectedDayOff(date) {
        return findDayOffByDate(dayOffs, date);
    });

    return {
        name: getSharedDayOffTextValue(selectedDayOffs, "name"),
        description: getSharedDayOffTextValue(selectedDayOffs, "description"),
        assignees: getSharedDayOffAssignees(selectedDayOffs),
    };
}


function findDayOffByDate(dayOffs, date) {
    return dayOffs.find(function matchDayOffDate(dayOff) {
        return dayOff.date === date;
    }) || null;
}


function getSharedDayOffTextValue(selectedDayOffs, fieldName) {
    if (selectedDayOffs.length === 0 || !selectedDayOffs[0]) {
        return "";
    }

    const firstValue = selectedDayOffs[0][fieldName] || "";
    const hasSameValue = selectedDayOffs.every(function matchDayOffValue(dayOff) {
        return dayOff && (dayOff[fieldName] || "") === firstValue;
    });

    if (!hasSameValue) {
        return "";
    }

    return firstValue;
}


function getSharedDayOffAssignees(selectedDayOffs) {
    if (selectedDayOffs.length === 0 || !selectedDayOffs[0]) {
        return [DAY_OFF_ALL_ASSIGNEES];
    }

    const firstAssignees = selectedDayOffs[0].assignees;
    const hasSameAssignees = selectedDayOffs.every(function matchDayOffAssignees(dayOff) {
        return dayOff && hasSameStringList(dayOff.assignees, firstAssignees);
    });

    if (!hasSameAssignees) {
        return [DAY_OFF_ALL_ASSIGNEES];
    }

    return [...firstAssignees];
}


function getDayOffHistoryLabel(dayOffDrawerMode) {
    if (dayOffDrawerMode === "edit") {
        return "Edit day-off";
    }

    return "Add day-off";
}


function getDayOffEditSelectedDates(currentSelectedDates, date) {
    if (currentSelectedDates.includes(date)) {
        return currentSelectedDates;
    }

    return [date];
}


function hasDayOffForSelectedDates(dayOffs, selectedDates) {
    if (selectedDates.length === 0) {
        return false;
    }

    const selectedDateSet = new Set(selectedDates);

    return dayOffs.some(function matchSelectedDate(dayOff) {
        return selectedDateSet.has(dayOff.date);
    });
}


function getNextSelectedDayOffDates(currentDates, date, selectionMode, anchorDate) {
    if (selectionMode.isRangeSelect) {
        const rangeDates = getDateRangeStrings(anchorDate || date, date);

        if (selectionMode.isMultiSelect) {
            return sortDateStrings([...new Set([...currentDates, ...rangeDates])]);
        }

        return rangeDates;
    }

    if (selectionMode.isMultiSelect) {
        return toggleSelectedDayOffDate(currentDates, date);
    }

    return [date];
}


function toggleSelectedDayOffDate(selectedDates, date) {
    if (selectedDates.includes(date)) {
        return selectedDates.filter(function keepDate(selectedDate) {
            return selectedDate !== date;
        });
    }

    return sortDateStrings([...selectedDates, date]);
}


function getDateRangeStrings(firstDate, secondDate) {
    const startDate = firstDate <= secondDate ? firstDate : secondDate;
    const stopDate = firstDate <= secondDate ? secondDate : firstDate;
    const dates = [];
    let currentDate = startDate;

    while (currentDate <= stopDate) {
        dates.push(currentDate);
        currentDate = addDaysToDateString(currentDate, 1);
    }

    return dates;
}


function sortDateStrings(dates) {
    return [...dates].sort();
}


function getDayOffLoadErrorMessage(error) {
    if (error && error.message) {
        return `Day-offs could not be loaded. ${error.message}`;
    }

    return "Day-offs could not be loaded.";
}


function getAssigneeLoadErrorMessage(error) {
    if (error && error.message) {
        return `Assignees could not be loaded. ${error.message}`;
    }

    return "Assignees could not be loaded.";
}


function getProjectNamesLoadErrorMessage(error) {
    if (error && error.message) {
        return `Projects could not be loaded. ${error.message}`;
    }

    return "Projects could not be loaded.";
}
