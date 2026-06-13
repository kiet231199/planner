import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Slider,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";

import PlannerDateField from "./PlannerDateField";
import {
    MULTI_PHASE_TASK_TYPE,
    RELEASE_TASK_TYPE,
    TASK_TYPE_OPTIONS,
} from "../constants/taskOptions";
import {
    createClientSubTaskId,
    doesSubTaskOverlap,
    sortSubTasksByStartDate,
} from "../utils/subTasks";


const SUB_TASK_TYPE_OPTIONS = TASK_TYPE_OPTIONS.filter(
    function excludeMultiPhase(type) {
        return type !== MULTI_PHASE_TASK_TYPE;
    },
);

const DEFAULT_NEW_SUB_TASK_VALUES = {
    name: "",
    taskType: "Plan",
    startDate: "",
    stopDate: "",
    progressPercent: 0,
};


const EMPTY_ROW_ERRORS = {
    name: "",
    taskType: "",
    startDate: "",
    stopDate: "",
    overlap: "",
};


function getUpdatedSubTaskFieldValue(subTask, fieldName, value) {
    if (fieldName !== "taskType") {
        if (fieldName === "startDate" && subTask.taskType === RELEASE_TASK_TYPE) {
            return {
                ...subTask,
                startDate: value,
                stopDate: value,
            };
        }

        return {
            ...subTask,
            [fieldName]: value,
        };
    }

    if (value === RELEASE_TASK_TYPE) {
        return {
            ...subTask,
            taskType: value,
            stopDate: subTask.startDate,
            progressPercent: 100,
        };
    }

    return {
        ...subTask,
        taskType: value,
    };
}


function normalizeSubTasks(subTasks) {
    return subTasks.map(function normalizeSubTask(subTask) {
        const isRelease = subTask.taskType === RELEASE_TASK_TYPE;

        return {
            ...subTask,
            name: subTask.name.trim(),
            stopDate: isRelease ? subTask.startDate : subTask.stopDate,
            progressPercent: isRelease ? 100 : subTask.progressPercent,
        };
    });
}


function validateSubTaskRows(subTasks) {
    const errors = {};

    subTasks.forEach(function validateSubTask(subTask) {
        const rowErrors = getSubTaskRowErrors(subTask, subTasks);

        if (hasSubTaskRowErrors(rowErrors)) {
            errors[subTask.id] = rowErrors;
        }
    });

    return {
        errors,
        hasErrors: Object.keys(errors).length > 0,
    };
}


function getSubTaskRowErrors(subTask, subTasks) {
    const errors = { ...EMPTY_ROW_ERRORS };
    const isRelease = subTask.taskType === RELEASE_TASK_TYPE;

    if (!subTask.name.trim()) {
        errors.name = "Name is required.";
    }

    if (!subTask.taskType) {
        errors.taskType = "Task type is required.";
    }

    if (!subTask.startDate) {
        errors.startDate = "Start date is required.";
    }

    if (!isRelease && !subTask.stopDate) {
        errors.stopDate = "End date is required.";
    }

    if (
        !isRelease
        && subTask.startDate
        && subTask.stopDate
        && subTask.stopDate < subTask.startDate
    ) {
        errors.stopDate = "End date must be on or after start date.";
    }

    if (
        subTask.startDate
        && (isRelease || subTask.stopDate)
        && doesSubTaskOverlap(subTasks, subTask, subTask.id)
    ) {
        errors.overlap = "This sub-task overlaps with another sub-task.";
    }

    return errors;
}


function hasSubTaskRowErrors(rowErrors) {
    return Object.values(rowErrors).some(function hasError(errorMessage) {
        return Boolean(errorMessage);
    });
}


function getNameHelperText(rowError) {
    if (!rowError) {
        return "";
    }

    return rowError.name || rowError.overlap || "";
}


export default function SubTaskDialog(props) {
    const {
        open,
        subTasks = [],
        initialEditSubTaskId = null,
        initialEditRequestId = null,
        onClose,
        onSave,
    } = props;

    const [draftSubTasks, setDraftSubTasks] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [rowErrors, setRowErrors] = useState({});

    useEffect(function syncWhenDialogOpens() {
        if (!open) {
            return;
        }

        const sortedSubTasks = sortSubTasksByStartDate(subTasks);
        const hasInitialEditSubTask = sortedSubTasks.some(
            function matchInitialEditSubTask(subTask) {
                return subTask.id === initialEditSubTaskId;
            },
        );

        setDraftSubTasks(sortedSubTasks);
        setSelectedIds(hasInitialEditSubTask ? [initialEditSubTaskId] : []);
        setRowErrors({});
    }, [open, subTasks, initialEditSubTaskId, initialEditRequestId]);

    const isAllSelected = (
        draftSubTasks.length > 0
        && selectedIds.length === draftSubTasks.length
    );
    const isPartiallySelected = (
        selectedIds.length > 0
        && selectedIds.length < draftSubTasks.length
    );

    function handleToggleAll() {
        if (isAllSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(draftSubTasks.map(function getId(st) {
                return st.id;
            }));
        }
    }

    function handleToggleRow(id) {
        setSelectedIds(function toggleId(current) {
            if (current.includes(id)) {
                return current.filter(function keepOther(x) {
                    return x !== id;
                });
            }

            return [...current, id];
        });
    }

    function handleAdd() {
        const newSubTask = {
            id: createClientSubTaskId(),
            ...DEFAULT_NEW_SUB_TASK_VALUES,
        };

        setDraftSubTasks(function addSubTask(current) {
            return [...current, newSubTask];
        });
        setSelectedIds([newSubTask.id]);
    }

    function handleSubTaskFieldChange(subTaskId, fieldName, value) {
        setDraftSubTasks(function updateSubTask(current) {
            return current.map(function updateMatchingSubTask(subTask) {
                if (subTask.id !== subTaskId) {
                    return subTask;
                }

                return getUpdatedSubTaskFieldValue(subTask, fieldName, value);
            });
        });
        setRowErrors(function clearRowError(currentErrors) {
            if (!currentErrors[subTaskId]) {
                return currentErrors;
            }

            const nextErrors = { ...currentErrors };

            delete nextErrors[subTaskId];

            return nextErrors;
        });
    }

    function handleProgressChange(subTaskId, newValue) {
        if (Array.isArray(newValue)) {
            return;
        }

        handleSubTaskFieldChange(subTaskId, "progressPercent", newValue);
    }

    function handleDeleteSelected() {
        const selectedIdSet = new Set(selectedIds);

        setDraftSubTasks(function removeSelected(current) {
            return current.filter(function keepUnselected(st) {
                return !selectedIdSet.has(st.id);
            });
        });
        setRowErrors(function removeDeletedErrors(currentErrors) {
            const nextErrors = { ...currentErrors };

            selectedIds.forEach(function removeRowError(subTaskId) {
                delete nextErrors[subTaskId];
            });

            return nextErrors;
        });
        setSelectedIds([]);
    }

    function handleSave() {
        const normalizedSubTasks = normalizeSubTasks(draftSubTasks);
        const { errors, hasErrors } = validateSubTaskRows(normalizedSubTasks);

        setRowErrors(errors);

        if (hasErrors) {
            return;
        }

        onSave(sortSubTasksByStartDate(normalizedSubTasks));
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                className: "name-color-manager-dialog-paper sub-task-manager-dialog-paper",
            }}
        >
            <DialogTitle>Manage Sub-tasks</DialogTitle>

            <DialogContent className="assignee-manager-content sub-task-manager-content">
                <Box className="assignee-manager-toolbar">
                    <Button
                        className="planner-action-button"
                        startIcon={<AddIcon />}
                        variant="outlined"
                        onClick={handleAdd}
                    >
                        Add
                    </Button>
                    <Button
                        className="planner-action-button"
                        startIcon={<DeleteOutlineIcon />}
                        variant="outlined"
                        color="error"
                        onClick={handleDeleteSelected}
                        disabled={selectedIds.length === 0}
                    >
                        Delete
                    </Button>
                </Box>

                <Box className="sub-task-manager-table-wrap">
                    <Table className="sub-task-manager-table" size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell className="sub-task-selection-cell" padding="checkbox">
                                    <Checkbox
                                        size="small"
                                        checked={isAllSelected}
                                        indeterminate={isPartiallySelected}
                                        onChange={handleToggleAll}
                                        disabled={draftSubTasks.length === 0}
                                    />
                                </TableCell>
                                <TableCell className="sub-task-name-cell">Task name</TableCell>
                                <TableCell className="sub-task-compact-cell">Type</TableCell>
                                <TableCell className="sub-task-date-cell">Start date</TableCell>
                                <TableCell className="sub-task-date-cell">End date</TableCell>
                                <TableCell className="sub-task-progress-cell">
                                    Progress
                                </TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {draftSubTasks.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            No sub-tasks yet. Click "Add" to get started.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}

                            {draftSubTasks.map(function renderSubTaskRow(subTask) {
                                const isSelected = selectedIds.includes(subTask.id);
                                const rowError = rowErrors[subTask.id] || {};
                                const isRelease = subTask.taskType === RELEASE_TASK_TYPE;

                                return (
                                    <TableRow key={subTask.id} selected={isSelected}>
                                        <TableCell
                                            className="sub-task-selection-cell"
                                            padding="checkbox"
                                        >
                                            <Checkbox
                                                size="small"
                                                checked={isSelected}
                                                onChange={function toggle() {
                                                    handleToggleRow(subTask.id);
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell className="sub-task-name-cell">
                                            <TextField
                                                value={subTask.name}
                                                size="small"
                                                fullWidth
                                                error={Boolean(rowError.name || rowError.overlap)}
                                                helperText={getNameHelperText(rowError)}
                                                onChange={function updateName(event) {
                                                    handleSubTaskFieldChange(
                                                        subTask.id,
                                                        "name",
                                                        event.target.value,
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell className="sub-task-compact-cell">
                                            <TextField
                                                value={subTask.taskType}
                                                size="small"
                                                select
                                                fullWidth
                                                error={Boolean(rowError.taskType)}
                                                helperText={rowError.taskType}
                                                onChange={function updateTaskType(event) {
                                                    handleSubTaskFieldChange(
                                                        subTask.id,
                                                        "taskType",
                                                        event.target.value,
                                                    );
                                                }}
                                            >
                                                {SUB_TASK_TYPE_OPTIONS.map(
                                                    function renderOption(type) {
                                                        return (
                                                            <MenuItem key={type} value={type}>
                                                                {type}
                                                            </MenuItem>
                                                        );
                                                    },
                                                )}
                                            </TextField>
                                        </TableCell>
                                        <TableCell className="sub-task-date-cell">
                                            <PlannerDateField
                                                value={subTask.startDate}
                                                name="startDate"
                                                size="small"
                                                fullWidth
                                                error={Boolean(rowError.startDate)}
                                                helperText={rowError.startDate}
                                                onChange={function updateStartDate(event) {
                                                    handleSubTaskFieldChange(
                                                        subTask.id,
                                                        "startDate",
                                                        event.target.value,
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell className="sub-task-date-cell">
                                            <PlannerDateField
                                                value={isRelease
                                                    ? subTask.startDate
                                                    : subTask.stopDate}
                                                name="stopDate"
                                                size="small"
                                                fullWidth
                                                disabled={isRelease}
                                                error={Boolean(rowError.stopDate)}
                                                helperText={rowError.stopDate}
                                                onChange={function updateStopDate(event) {
                                                    handleSubTaskFieldChange(
                                                        subTask.id,
                                                        "stopDate",
                                                        event.target.value,
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell className="sub-task-progress-cell">
                                            <Box className="sub-task-inline-progress">
                                                <Typography variant="body2">
                                                    {subTask.progressPercent}%
                                                </Typography>
                                                <Slider
                                                    value={subTask.progressPercent}
                                                    min={0}
                                                    max={100}
                                                    step={5}
                                                    size="small"
                                                    disabled={isRelease}
                                                    onChange={function updateProgress(_, value) {
                                                        handleProgressChange(subTask.id, value);
                                                    }}
                                                />
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Box>
            </DialogContent>

            <DialogActions>
                <Button
                    className="planner-action-button"
                    variant="outlined"
                    onClick={onClose}
                >
                    Cancel
                </Button>
                <Button
                    className="planner-action-button"
                    variant="contained"
                    onClick={handleSave}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}
