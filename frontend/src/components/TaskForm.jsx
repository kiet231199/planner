import { useEffect, useMemo, useState } from "react";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import {
    Box,
    Button,
    FormControl,
    FormHelperText,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Slider,
    TextField,
    Tooltip,
} from "@mui/material";

import AssigneeManagerDialog from "./AssigneeManagerDialog";
import {
    DEFAULT_TASK_LEVEL,
    DEFAULT_TASK_TYPE,
    RELEASE_TASK_TYPE,
    TASK_LEVEL_OPTIONS,
    TASK_TYPE_OPTIONS,
    UNASSIGNED_ASSIGNEE,
} from "../constants/taskOptions";


const DEFAULT_FORM_VALUES = {
    name: "",
    description: "",
    url: "",
    assignee: UNASSIGNED_ASSIGNEE,
    taskType: DEFAULT_TASK_TYPE,
    taskLevel: DEFAULT_TASK_LEVEL,
    startDate: "",
    stopDate: "",
    progressPercent: 0,
};
const PROGRESS_SLIDER_STEP = 5;
const PROGRESS_SLIDER_MARKS = [
    {
        value: 0,
        label: "0%",
    },
    {
        value: 50,
        label: "50%",
    },
    {
        value: 100,
        label: "100%",
    },
];


export default function TaskForm(props) {
    const {
        initialTask,
        isSaving,
        assignees = [],
        isAssigneeSaving,
        onCancel,
        onSaveAssignees,
        onSubmitTask,
    } = props;
    const [formValues, setFormValues] = useState(function getInitialState() {
        return getInitialFormValues(initialTask);
    });
    const [formErrors, setFormErrors] = useState({});
    const [isAssigneeManagerOpen, setIsAssigneeManagerOpen] = useState(false);
    const assigneeOptions = useMemo(function memoizeAssigneeOptions() {
        return getAssigneeOptions(assignees);
    }, [assignees]);
    const isReleaseTask = formValues.taskType === RELEASE_TASK_TYPE;

    useEffect(function keepSelectedAssigneeSupported() {
        setFormValues(function updateUnsupportedAssignee(currentValues) {
            if (assigneeOptions.includes(currentValues.assignee)) {
                return currentValues;
            }

            return {
                ...currentValues,
                assignee: UNASSIGNED_ASSIGNEE,
            };
        });
    }, [assigneeOptions]);

    function handleFieldChange(event) {
        const { name, value } = event.target;

        if (name === "taskType") {
            handleTaskTypeChange(value);
            return;
        }

        setFormValues(function updateFormValues(currentValues) {
            if (name === "startDate" && currentValues.taskType === RELEASE_TASK_TYPE) {
                return {
                    ...currentValues,
                    startDate: value,
                    stopDate: value,
                };
            }

            return {
                ...currentValues,
                [name]: value,
            };
        });
    }

    function handleTaskTypeChange(taskType) {
        setFormValues(function updateTaskType(currentValues) {
            if (taskType !== RELEASE_TASK_TYPE) {
                return {
                    ...currentValues,
                    taskType,
                };
            }

            const releaseDate = currentValues.startDate || currentValues.stopDate;

            return {
                ...currentValues,
                taskType,
                startDate: releaseDate,
                stopDate: releaseDate,
                progressPercent: 100,
            };
        });
    }

    function handleProgressChange(_, value) {
        setFormValues(function updateFormValues(currentValues) {
            return {
                ...currentValues,
                progressPercent: value,
            };
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const nextErrors = validateForm(formValues);
        setFormErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        const wasSaved = await onSubmitTask(normalizeTaskDraft(formValues));

        if (wasSaved) {
            resetForm();
        }
    }

    function handleCancel() {
        resetForm();
        onCancel();
    }

    function resetForm() {
        setFormValues(getInitialFormValues(initialTask));
        setFormErrors({});
    }

    function handleOpenAssigneeManager() {
        setIsAssigneeManagerOpen(true);
    }

    function handleCloseAssigneeManager() {
        setIsAssigneeManagerOpen(false);
    }

    async function handleSaveAssignees(assigneeUpdate) {
        const saveResult = await onSaveAssignees(assigneeUpdate);

        if (!saveResult) {
            return null;
        }

        setFormValues(function updateSelectedAssignee(currentValues) {
            return {
                ...currentValues,
                assignee: getUpdatedSelectedAssignee(currentValues.assignee, assigneeUpdate),
            };
        });

        return saveResult;
    }

    return (
        <>
            <Box component="form" className="task-form" onSubmit={handleSubmit}>
                <TextField
                    label="Task name"
                    name="name"
                    value={formValues.name}
                    error={Boolean(formErrors.name)}
                    helperText={formErrors.name}
                    required
                    fullWidth
                    onChange={handleFieldChange}
                />
                <TextField
                    label="Task description"
                    name="description"
                    value={formValues.description}
                    multiline
                    minRows={3}
                    fullWidth
                    onChange={handleFieldChange}
                />
                <TextField
                    label="URL"
                    name="url"
                    value={formValues.url}
                    fullWidth
                    onChange={handleFieldChange}
                />
                <Box className="assignee-field-row">
                    <FormControl fullWidth className="assignee-select-control">
                        <InputLabel id="assignee-label">Assignee</InputLabel>
                        <Select
                            labelId="assignee-label"
                            label="Assignee"
                            name="assignee"
                            value={formValues.assignee}
                            onChange={handleFieldChange}
                        >
                            {assigneeOptions.map(function renderAssignee(option) {
                                return (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                );
                            })}
                        </Select>
                    </FormControl>
                    <Tooltip title="Manage assignees">
                        <IconButton
                            className="assignee-manager-button"
                            aria-label="Manage assignees"
                            disabled={isSaving || isAssigneeSaving}
                            onClick={handleOpenAssigneeManager}
                        >
                            <ManageAccountsOutlinedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
                <FormControl fullWidth required error={Boolean(formErrors.taskType)}>
                    <InputLabel id="task-type-label">Task type</InputLabel>
                    <Select
                        labelId="task-type-label"
                        label="Task type"
                        name="taskType"
                        value={formValues.taskType}
                        onChange={handleFieldChange}
                    >
                        {TASK_TYPE_OPTIONS.map(function renderTaskType(option) {
                            return (
                                <MenuItem key={option} value={option}>
                                    {option}
                                </MenuItem>
                            );
                        })}
                    </Select>
                    {formErrors.taskType && <FormHelperText>{formErrors.taskType}</FormHelperText>}
                </FormControl>
                <FormControl fullWidth>
                    <InputLabel id="task-level-label">Task level</InputLabel>
                    <Select
                        labelId="task-level-label"
                        label="Task level"
                        name="taskLevel"
                        value={formValues.taskLevel}
                        onChange={handleFieldChange}
                    >
                        {TASK_LEVEL_OPTIONS.map(function renderTaskLevel(option) {
                            return (
                                <MenuItem key={option} value={option}>
                                    {option}
                                </MenuItem>
                            );
                        })}
                    </Select>
                </FormControl>
                {isReleaseTask ? (
                    <TextField
                        label="Release date"
                        name="startDate"
                        type="date"
                        value={formValues.startDate}
                        error={Boolean(formErrors.startDate)}
                        helperText={formErrors.startDate}
                        required
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        onChange={handleFieldChange}
                    />
                ) : (
                    <Box className="date-field-row">
                        <TextField
                            label="Start date"
                            name="startDate"
                            type="date"
                            value={formValues.startDate}
                            error={Boolean(formErrors.startDate)}
                            helperText={formErrors.startDate}
                            required
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            onChange={handleFieldChange}
                        />
                        <TextField
                            label="Stop date"
                            name="stopDate"
                            type="date"
                            value={formValues.stopDate}
                            error={Boolean(formErrors.stopDate)}
                            helperText={formErrors.stopDate}
                            required
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            onChange={handleFieldChange}
                        />
                    </Box>
                )}
                {!isReleaseTask && (
                    <Box className="progress-field">
                        <Slider
                            className="progress-slider"
                            value={formValues.progressPercent}
                            min={0}
                            max={100}
                            step={PROGRESS_SLIDER_STEP}
                            marks={PROGRESS_SLIDER_MARKS}
                            valueLabelDisplay="on"
                            valueLabelFormat={formatProgressValue}
                            onChange={handleProgressChange}
                        />
                    </Box>
                )}
                <Box className="task-form-actions">
                    <Button
                        className="planner-action-button"
                        variant="outlined"
                        disabled={isSaving}
                        onClick={handleCancel}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="planner-action-button"
                        variant="contained"
                        type="submit"
                        disabled={isSaving}
                    >
                        Save
                    </Button>
                </Box>
            </Box>
            <AssigneeManagerDialog
                open={isAssigneeManagerOpen}
                assignees={assignees}
                isSaving={isAssigneeSaving}
                onClose={handleCloseAssigneeManager}
                onSave={handleSaveAssignees}
            />
        </>
    );
}


function validateForm(formValues) {
    const errors = {};

    if (!formValues.name.trim()) {
        errors.name = "Task name is required.";
    }

    if (!formValues.taskType.trim()) {
        errors.taskType = "Task type is required.";
    }

    if (!formValues.startDate) {
        errors.startDate = "Start date is required.";
    }

    if (formValues.taskType !== RELEASE_TASK_TYPE && !formValues.stopDate) {
        errors.stopDate = "Stop date is required.";
    }

    if (
        formValues.taskType !== RELEASE_TASK_TYPE
        && formValues.startDate
        && formValues.stopDate
        && formValues.stopDate < formValues.startDate
    ) {
        errors.stopDate = "Stop date must be on or after start date.";
    }

    return errors;
}


function getInitialFormValues(task) {
    if (!task) {
        return DEFAULT_FORM_VALUES;
    }

    return {
        name: task.name || "",
        description: task.description || "",
        url: task.url || "",
        assignee: task.assignee || UNASSIGNED_ASSIGNEE,
        taskType: getSupportedTaskType(task.taskType),
        taskLevel: getSupportedTaskLevel(task.taskLevel),
        startDate: task.startDate || "",
        stopDate: task.taskType === RELEASE_TASK_TYPE
            ? task.startDate || ""
            : task.stopDate || "",
        progressPercent: task.taskType === RELEASE_TASK_TYPE
            ? 100
            : task.progressPercent || 0,
    };
}


function normalizeTaskDraft(formValues) {
    return {
        name: formValues.name.trim(),
        description: formValues.description.trim(),
        url: formValues.url.trim(),
        assignee: formValues.assignee,
        taskType: formValues.taskType,
        taskLevel: formValues.taskLevel,
        startDate: formValues.startDate,
        stopDate: formValues.taskType === RELEASE_TASK_TYPE
            ? formValues.startDate
            : formValues.stopDate,
        progressPercent: formValues.taskType === RELEASE_TASK_TYPE
            ? 100
            : formValues.progressPercent,
    };
}


function getAssigneeOptions(assignees) {
    const assigneeNames = assignees.map(function mapAssigneeName(assignee) {
        return assignee.name;
    });

    return [
        UNASSIGNED_ASSIGNEE,
        ...assigneeNames,
    ];
}


function getSupportedTaskType(taskType) {
    if (TASK_TYPE_OPTIONS.includes(taskType)) {
        return taskType;
    }

    return DEFAULT_TASK_TYPE;
}


function getSupportedTaskLevel(taskLevel) {
    if (TASK_LEVEL_OPTIONS.includes(taskLevel)) {
        return taskLevel;
    }

    return DEFAULT_TASK_LEVEL;
}


function getUpdatedSelectedAssignee(selectedAssignee, assigneeUpdate) {
    const renamedAssignee = assigneeUpdate.renamedAssignees.find(function matchRenamedAssignee(
        assignee,
    ) {
        return assignee.previousName === selectedAssignee;
    });

    if (renamedAssignee) {
        return renamedAssignee.nextName;
    }

    if (assigneeUpdate.deletedAssignees.includes(selectedAssignee)) {
        return UNASSIGNED_ASSIGNEE;
    }

    return selectedAssignee;
}


function formatProgressValue(value) {
    return `${value}%`;
}
