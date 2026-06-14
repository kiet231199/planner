import { useEffect, useMemo, useState } from "react";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControl,
    FormHelperText,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Slider,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";

import AssigneeManagerDialog from "./AssigneeManagerDialog";
import PlannerDateField from "./PlannerDateField";
import ProjectManagerDialog from "./ProjectManagerDialog";
import SubTaskDialog from "./SubTaskDialog";
import {
    DEFAULT_TASK_LEVEL,
    DEFAULT_TASK_TYPE,
    MULTI_PHASE_TASK_TYPE,
    NO_PROJECT_NAME,
    RELEASE_TASK_TYPE,
    TASK_LEVEL_OPTIONS,
    TASK_TYPE_OPTIONS,
    UNASSIGNED_ASSIGNEE,
} from "../constants/taskOptions";
import { computeMultiPhaseTaskDates } from "../utils/chartScale";
import {
    createClientSubTaskId,
    sortSubTasksByStartDate,
} from "../utils/subTasks";


const DEFAULT_FORM_VALUES = {
    name: "",
    description: "",
    url: "",
    assignee: UNASSIGNED_ASSIGNEE,
    projectName: NO_PROJECT_NAME,
    taskType: DEFAULT_TASK_TYPE,
    taskLevel: DEFAULT_TASK_LEVEL,
    startDate: "",
    stopDate: "",
    progressPercent: 0,
    parentTaskId: "",
    subTasks: [],
};
const FORM_FIELD_NAMES = Object.keys(DEFAULT_FORM_VALUES);
const MIXED_TEXT_VALUE = "...";
const MIXED_SELECT_VALUE = "__mixed__";
const PROGRESS_SLIDER_STEP = 5;


export default function TaskForm(props) {
    const {
        initialTask,
        initialTasks = [],
        initialParentTaskId = "",
        isSaving,
        assignees = [],
        projectNames = [],
        isAssigneeSaving,
        isProjectSaving,
        subTaskEditRequest,
        onCancel,
        onSaveAssignees,
        onSaveProjectNames,
        onSubmitTask,
    } = props;
    const editTasks = getEditTasks(initialTask, initialTasks);
    const isEditMode = editTasks.length > 0;
    const isBulkEditMode = editTasks.length > 1;
    const [formValues, setFormValues] = useState(function getInitialState() {
        return getInitialFormValuesForMode(initialTask, editTasks, initialParentTaskId);
    });
    const [formErrors, setFormErrors] = useState({});
    const [mixedFields] = useState(function getInitialMixedState() {
        return getMixedFieldSet(editTasks);
    });
    const [dirtyFields, setDirtyFields] = useState(function getInitialDirtyFieldState() {
        return new Set();
    });
    const [isAssigneeManagerOpen, setIsAssigneeManagerOpen] = useState(false);
    const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
    const [isSubTaskDialogOpen, setIsSubTaskDialogOpen] = useState(false);
    const [pendingTaskType, setPendingTaskType] = useState(null);
    const assigneeOptions = useMemo(function memoizeAssigneeOptions() {
        return getAssigneeOptions(assignees);
    }, [assignees]);
    const projectOptions = useMemo(function memoizeProjectOptions() {
        return getProjectOptions(projectNames);
    }, [projectNames]);
    const isReleaseTask = formValues.taskType === RELEASE_TASK_TYPE;
    const isMultiPhaseTask = formValues.taskType === MULTI_PHASE_TASK_TYPE;
    const isParentTask = !isBulkEditMode && Array.isArray(initialTask?.childTasks)
        && initialTask.childTasks.length > 0;
    const shouldShowDateRangeFields = shouldShowTaskDateRangeFields(
        isBulkEditMode,
        isReleaseTask,
        isMultiPhaseTask,
    );
    const shouldShowTaskLevelField = shouldShowTaskLevelSelect(
        isBulkEditMode,
        isReleaseTask,
        isMultiPhaseTask,
    );
    const shouldShowProgressField = !isMultiPhaseTask || isBulkEditMode;
    const isCopyTaskIdDisabled = !isEditMode || isBulkEditMode || !initialTask?.id;
    const initialEditSubTaskId = getInitialEditSubTaskId(
        subTaskEditRequest,
        initialTask,
        isMultiPhaseTask,
        formValues.subTasks,
    );
    const initialEditSubTaskRequestId = initialEditSubTaskId
        ? subTaskEditRequest.requestId
        : null;

    useEffect(function keepSelectedAssigneeSupported() {
        setFormValues(function updateUnsupportedAssignee(currentValues) {
            if (currentValues.assignee === MIXED_SELECT_VALUE) {
                return currentValues;
            }

            if (assigneeOptions.includes(currentValues.assignee)) {
                return currentValues;
            }

            return {
                ...currentValues,
                assignee: UNASSIGNED_ASSIGNEE,
            };
        });
    }, [assigneeOptions]);

    useEffect(function keepSelectedProjectSupported() {
        setFormValues(function updateUnsupportedProject(currentValues) {
            if (currentValues.projectName === MIXED_SELECT_VALUE) {
                return currentValues;
            }

            if (projectOptions.includes(currentValues.projectName)) {
                return currentValues;
            }

            return {
                ...currentValues,
                projectName: NO_PROJECT_NAME,
            };
        });
    }, [projectOptions]);

    useEffect(function openRequestedSubTaskEditor() {
        if (!initialEditSubTaskId) {
            return;
        }

        setIsSubTaskDialogOpen(true);
    }, [initialEditSubTaskId, initialEditSubTaskRequestId]);

    function handleFieldChange(event) {
        const { name, value } = event.target;

        if (name === "taskType") {
            markFieldDirty(name);
            handleTaskTypeChange(value);
            return;
        }

        markFieldDirty(name);
        setFormValues(function updateFormValues(currentValues) {
            if (
                name === "startDate"
                && currentValues.taskType === RELEASE_TASK_TYPE
                && !shouldShowDateRangeFields
            ) {
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
        const leavingMultiPhase = (
            formValues.taskType === MULTI_PHASE_TASK_TYPE
            && taskType !== MULTI_PHASE_TASK_TYPE
            && formValues.subTasks.length > 0
        );

        if (leavingMultiPhase) {
            setPendingTaskType(taskType);

            return;
        }

        applyTaskTypeChange(taskType);
    }

    function applyTaskTypeChange(taskType) {
        setFormValues(function updateTaskType(currentValues) {
            if (taskType !== RELEASE_TASK_TYPE) {
                const isEnteringMultiPhase = (
                    taskType === MULTI_PHASE_TASK_TYPE
                    && currentValues.taskType !== MULTI_PHASE_TASK_TYPE
                    && isEditMode
                    && !isBulkEditMode
                );
                const subTasks = getSubTasksForTaskTypeChange(
                    currentValues,
                    taskType,
                    isEnteringMultiPhase,
                );

                return {
                    ...currentValues,
                    taskType,
                    subTasks,
                };
            }

            const releaseDate = currentValues.startDate || currentValues.stopDate;

            return {
                ...currentValues,
                taskType,
                taskLevel: DEFAULT_TASK_LEVEL,
                startDate: releaseDate,
                stopDate: releaseDate,
                progressPercent: 100,
                subTasks: [],
            };
        });
    }

    function handleConfirmTypeChange() {
        if (!pendingTaskType) {
            return;
        }

        applyTaskTypeChange(pendingTaskType);
        setPendingTaskType(null);
    }

    function handleCancelTypeChange() {
        setPendingTaskType(null);
    }

    function handleSubTasksSave(newSubTasks) {
        markFieldDirty("subTasks");
        setFormValues(function updateSubTasks(currentValues) {
            return {
                ...currentValues,
                subTasks: sortSubTasksByStartDate(newSubTasks),
            };
        });
        setIsSubTaskDialogOpen(false);
    }

    function handleProgressChange(_, value) {
        markFieldDirty("progressPercent");
        setFormValues(function updateFormValues(currentValues) {
            return {
                ...currentValues,
                progressPercent: value,
            };
        });
    }

    function handleMixedTextFocus(event) {
        const { name } = event.target;

        if (!isBulkEditMode || dirtyFields.has(name) || !mixedFields.has(name)) {
            return;
        }

        event.target.select();
    }

    function markFieldDirty(fieldName) {
        if (!isBulkEditMode) {
            return;
        }

        setDirtyFields(function updateDirtyFields(currentDirtyFields) {
            const nextDirtyFields = new Set(currentDirtyFields);
            nextDirtyFields.add(fieldName);

            return nextDirtyFields;
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const nextErrors = isBulkEditMode
            ? validateBulkForm(formValues, dirtyFields, editTasks)
            : validateForm(formValues);
        setFormErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        const taskDraft = isBulkEditMode
            ? normalizeBulkTaskPatch(formValues, dirtyFields)
            : normalizeTaskDraft(formValues);
        const wasSaved = await onSubmitTask(taskDraft);

        if (wasSaved) {
            resetForm();
        }
    }

    function handleCancel() {
        resetForm();
        onCancel();
    }

    function resetForm() {
        setFormValues(getInitialFormValuesForMode(initialTask, editTasks, initialParentTaskId));
        setFormErrors({});
        setDirtyFields(new Set());
    }

    function handleOpenAssigneeManager() {
        setIsAssigneeManagerOpen(true);
    }

    function handleCloseAssigneeManager() {
        setIsAssigneeManagerOpen(false);
    }

    function handleOpenProjectManager() {
        setIsProjectManagerOpen(true);
    }

    function handleCopyTaskId() {
        if (isCopyTaskIdDisabled || !navigator.clipboard) {
            return;
        }

        void navigator.clipboard.writeText(initialTask.id).catch(function ignoreCopyError() {});
    }

    function handleCloseProjectManager() {
        setIsProjectManagerOpen(false);
    }

    async function handleSaveAssignees(assigneeUpdate) {
        const saveResult = await onSaveAssignees(assigneeUpdate);

        if (!saveResult) {
            return null;
        }

        setFormValues(function updateSelectedAssignee(currentValues) {
            if (currentValues.assignee === MIXED_SELECT_VALUE) {
                return currentValues;
            }

            return {
                ...currentValues,
                assignee: getUpdatedSelectedAssignee(currentValues.assignee, assigneeUpdate),
            };
        });

        return saveResult;
    }

    async function handleSaveProjectNames(projectUpdate) {
        const saveResult = await onSaveProjectNames(projectUpdate);

        if (!saveResult) {
            return null;
        }

        setFormValues(function updateSelectedProject(currentValues) {
            if (currentValues.projectName === MIXED_SELECT_VALUE) {
                return currentValues;
            }

            return {
                ...currentValues,
                projectName: getUpdatedSelectedProject(currentValues.projectName, projectUpdate),
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
                    helperText={getFieldHelperText("name", formErrors, mixedFields, dirtyFields)}
                    required={isRequiredField("name", mixedFields, dirtyFields, isBulkEditMode)}
                    fullWidth
                    onFocus={handleMixedTextFocus}
                    onChange={handleFieldChange}
                />
                <TextField
                    label="Task description"
                    name="description"
                    value={formValues.description}
                    multiline
                    minRows={3}
                    helperText={getFieldHelperText(
                        "description",
                        formErrors,
                        mixedFields,
                        dirtyFields,
                    )}
                    fullWidth
                    onFocus={handleMixedTextFocus}
                    onChange={handleFieldChange}
                />
                <TextField
                    label="URL"
                    name="url"
                    value={formValues.url}
                    helperText={getFieldHelperText("url", formErrors, mixedFields, dirtyFields)}
                    fullWidth
                    onFocus={handleMixedTextFocus}
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
                            {formValues.assignee === MIXED_SELECT_VALUE && (
                                <MenuItem value={MIXED_SELECT_VALUE} disabled>
                                    Mixed values
                                </MenuItem>
                            )}
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
                <Box className="assignee-field-row">
                    <FormControl fullWidth required error={Boolean(formErrors.taskType)}>
                        <InputLabel id="task-type-label">Task type</InputLabel>
                        <Select
                            labelId="task-type-label"
                            label="Task type"
                            name="taskType"
                            value={formValues.taskType}
                            onChange={handleFieldChange}
                        >
                            {formValues.taskType === MIXED_SELECT_VALUE && (
                                <MenuItem value={MIXED_SELECT_VALUE} disabled>
                                    Mixed values
                                </MenuItem>
                            )}
                            {TASK_TYPE_OPTIONS.map(function renderTaskType(option) {
                                return (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                );
                            })}
                        </Select>
                        {formErrors.taskType && (
                            <FormHelperText>{formErrors.taskType}</FormHelperText>
                        )}
                    </FormControl>
                    <Tooltip title="Manage sub-tasks">
                        <IconButton
                            className="assignee-manager-button"
                            aria-label="Manage sub-tasks"
                            disabled={!isMultiPhaseTask || isBulkEditMode || isSaving}
                            onClick={function openSubTaskDialog() {
                                setIsSubTaskDialogOpen(true);
                            }}
                        >
                            <AssignmentIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
                {shouldShowTaskLevelField && (
                    <FormControl fullWidth>
                        <InputLabel id="task-level-label">Task level</InputLabel>
                        <Select
                            labelId="task-level-label"
                            label="Task level"
                            name="taskLevel"
                            value={formValues.taskLevel}
                            onChange={handleFieldChange}
                        >
                            {formValues.taskLevel === MIXED_SELECT_VALUE && (
                                <MenuItem value={MIXED_SELECT_VALUE} disabled>
                                    Mixed values
                                </MenuItem>
                            )}
                            {TASK_LEVEL_OPTIONS.map(function renderTaskLevel(option) {
                                return (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                );
                            })}
                        </Select>
                    </FormControl>
                )}
                <Box className="assignee-field-row">
                    <FormControl fullWidth className="assignee-select-control">
                        <InputLabel id="project-name-label">Project</InputLabel>
                        <Select
                            labelId="project-name-label"
                            label="Project"
                            name="projectName"
                            value={formValues.projectName}
                            onChange={handleFieldChange}
                        >
                            {formValues.projectName === MIXED_SELECT_VALUE && (
                                <MenuItem value={MIXED_SELECT_VALUE} disabled>
                                    Mixed values
                                </MenuItem>
                            )}
                            {projectOptions.map(function renderProject(option) {
                                return (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                );
                            })}
                        </Select>
                    </FormControl>
                    <Tooltip title="Manage project">
                        <IconButton
                            className="assignee-manager-button"
                            aria-label="Manage project"
                            disabled={isSaving || isProjectSaving}
                            onClick={handleOpenProjectManager}
                        >
                            <AccountTreeOutlinedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
                {(!shouldShowDateRangeFields && !isMultiPhaseTask) ? (
                    <PlannerDateField
                        label="Release date"
                        name="startDate"
                        value={formValues.startDate}
                        error={Boolean(formErrors.startDate)}
                        helperText={getFieldHelperText(
                            "startDate",
                            formErrors,
                            mixedFields,
                            dirtyFields,
                        )}
                        required={isRequiredField(
                            "startDate",
                            mixedFields,
                            dirtyFields,
                            isBulkEditMode,
                        )}
                        fullWidth
                        disabled={isParentTask}
                        onChange={handleFieldChange}
                    />
                ) : (
                    !isMultiPhaseTask && (
                    <Box className="date-field-row">
                        <PlannerDateField
                            label="Start date"
                            name="startDate"
                            value={formValues.startDate}
                            error={Boolean(formErrors.startDate)}
                            helperText={getFieldHelperText(
                                "startDate",
                                formErrors,
                                mixedFields,
                                dirtyFields,
                            )}
                            required={isRequiredField(
                                "startDate",
                                mixedFields,
                                dirtyFields,
                                isBulkEditMode,
                            )}
                            fullWidth
                            disabled={isParentTask}
                            onChange={handleFieldChange}
                        />
                        <PlannerDateField
                            label="End date"
                            name="stopDate"
                            value={formValues.stopDate}
                            error={Boolean(formErrors.stopDate)}
                            helperText={getFieldHelperText(
                                "stopDate",
                                formErrors,
                                mixedFields,
                                dirtyFields,
                            )}
                            required={
                                formValues.taskType !== RELEASE_TASK_TYPE
                                && isRequiredField(
                                    "stopDate",
                                    mixedFields,
                                    dirtyFields,
                                    isBulkEditMode,
                                )
                            }
                            fullWidth
                            disabled={isParentTask}
                            onChange={handleFieldChange}
                        />
                    </Box>
                    )
                )}
                {shouldShowProgressField && (!isReleaseTask || isBulkEditMode) && (
                    <Box className="progress-field">
                        <Box className="sub-task-inline-progress">
                            <Typography variant="body2">
                                {formatProgressValue(
                                    formValues.progressPercent,
                                    mixedFields.has("progressPercent"),
                                    dirtyFields.has("progressPercent"),
                                )}
                            </Typography>
                            <Slider
                                value={formValues.progressPercent}
                                min={0}
                                max={100}
                                step={PROGRESS_SLIDER_STEP}
                                size="small"
                                disabled={isParentTask}
                                onChange={handleProgressChange}
                            />
                        </Box>
                        {getFieldHelperText(
                            "progressPercent",
                            formErrors,
                            mixedFields,
                            dirtyFields,
                        ) && (
                            <FormHelperText>
                                {getFieldHelperText(
                                    "progressPercent",
                                    formErrors,
                                    mixedFields,
                                    dirtyFields,
                                )}
                            </FormHelperText>
                        )}
                    </Box>
                )}
                <Box className="assignee-field-row">
                    <TextField
                        label="Parent task"
                        name="parentTaskId"
                        value={formValues.parentTaskId}
                        helperText={getFieldHelperText(
                            "parentTaskId",
                            formErrors,
                            mixedFields,
                            dirtyFields,
                        )}
                        fullWidth
                        onFocus={handleMixedTextFocus}
                        onChange={handleFieldChange}
                    />
                    <Tooltip title="Copy task id">
                        <span>
                            <IconButton
                                className="assignee-manager-button"
                                aria-label="Copy task id"
                                disabled={isCopyTaskIdDisabled}
                                onClick={handleCopyTaskId}
                            >
                                <ContentCopyOutlinedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
                {formErrors.subTasks && (
                    <Typography variant="caption" color="error">
                        {formErrors.subTasks}
                    </Typography>
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
            <ProjectManagerDialog
                open={isProjectManagerOpen}
                projectNames={projectNames}
                isSaving={isProjectSaving}
                onClose={handleCloseProjectManager}
                onSave={handleSaveProjectNames}
            />
            <SubTaskDialog
                open={isSubTaskDialogOpen}
                subTasks={formValues.subTasks}
                initialEditSubTaskId={initialEditSubTaskId}
                initialEditRequestId={initialEditSubTaskRequestId}
                onClose={function closeSubTaskDialog() {
                    setIsSubTaskDialogOpen(false);
                }}
                onSave={handleSubTasksSave}
            />
            <Dialog open={pendingTaskType !== null} onClose={handleCancelTypeChange}>
                <DialogTitle>Change Task Type?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Changing the task type will remove all sub-tasks. Continue?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelTypeChange} color="inherit">
                        Cancel
                    </Button>
                    <Button onClick={handleConfirmTypeChange} color="error" variant="contained">
                        Remove Sub-tasks
                    </Button>
                </DialogActions>
            </Dialog>
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

    if (formValues.taskType === MULTI_PHASE_TASK_TYPE) {
        if (!formValues.subTasks || formValues.subTasks.length === 0) {
            errors.subTasks = "At least one sub-task is required.";
        }

        return errors;
    }

    if (!formValues.startDate) {
        errors.startDate = "Start date is required.";
    }

    if (formValues.taskType !== RELEASE_TASK_TYPE && !formValues.stopDate) {
        errors.stopDate = "End date is required.";
    }

    if (
        formValues.taskType !== RELEASE_TASK_TYPE
        && formValues.startDate
        && formValues.stopDate
        && formValues.stopDate < formValues.startDate
    ) {
        errors.stopDate = "End date must be on or after start date.";
    }

    return errors;
}


function validateBulkForm(formValues, dirtyFields, tasks) {
    const errors = {};
    const bulkPatch = normalizeBulkTaskPatch(formValues, dirtyFields);

    if (dirtyFields.has("name") && !bulkPatch.name) {
        errors.name = "Task name is required.";
    }

    if (dirtyFields.has("taskType") && !bulkPatch.taskType) {
        errors.taskType = "Task type is required.";
    }

    if (dirtyFields.has("startDate") && !bulkPatch.startDate) {
        errors.startDate = "Start date is required.";
    }

    if (dirtyFields.has("stopDate") && !bulkPatch.stopDate) {
        const hasNonReleaseTask = tasks.some(function matchNonReleaseTask(task) {
            const nextTaskType = bulkPatch.taskType || task.taskType;

            return nextTaskType !== RELEASE_TASK_TYPE;
        });

        if (hasNonReleaseTask) {
            errors.stopDate = "End date is required.";
        }
    }

    const hasInvalidDateRange = tasks.some(function matchInvalidTaskRange(task) {
        const nextTask = applyBulkTaskPatchPreview(task, bulkPatch);

        return (
            nextTask.taskType !== RELEASE_TASK_TYPE
            && nextTask.startDate
            && nextTask.stopDate
            && nextTask.stopDate < nextTask.startDate
        );
    });

    if (hasInvalidDateRange) {
        errors.stopDate = "End date must be on or after start date.";
    }

    return errors;
}


function getInitialFormValuesForMode(initialTask, editTasks, initialParentTaskId) {
    if (editTasks.length > 1) {
        return getBulkInitialFormValues(editTasks);
    }

    if (editTasks.length === 1) {
        return getInitialFormValues(editTasks[0]);
    }

    return {
        ...getInitialFormValues(initialTask),
        parentTaskId: initialParentTaskId,
    };
}


function shouldShowTaskDateRangeFields(isBulkEditMode, isReleaseTask, isMultiPhaseTask) {
    if (isMultiPhaseTask && !isBulkEditMode) {
        return false;
    }

    return isBulkEditMode || !isReleaseTask;
}


function shouldShowTaskLevelSelect(isBulkEditMode, isReleaseTask, isMultiPhaseTask) {
    if (isMultiPhaseTask && !isBulkEditMode) {
        return false;
    }

    return isBulkEditMode || !isReleaseTask;
}


function getSubTasksForTaskTypeChange(currentValues, taskType, isEnteringMultiPhase) {
    if (taskType !== MULTI_PHASE_TASK_TYPE) {
        return [];
    }

    if (!isEnteringMultiPhase) {
        return currentValues.subTasks;
    }

    return [createSubTaskFromTaskValues(currentValues)];
}


function createSubTaskFromTaskValues(taskValues) {
    const isRelease = taskValues.taskType === RELEASE_TASK_TYPE;
    const startDate = taskValues.startDate;
    const stopDate = isRelease ? startDate : taskValues.stopDate;

    return {
        id: createClientSubTaskId(),
        name: taskValues.name,
        taskType: getSubTaskTypeFromTaskType(taskValues.taskType),
        startDate,
        stopDate,
        progressPercent: isRelease ? 100 : taskValues.progressPercent,
    };
}


function getSubTaskTypeFromTaskType(taskType) {
    if (taskType === MULTI_PHASE_TASK_TYPE || taskType === MIXED_SELECT_VALUE) {
        return DEFAULT_TASK_TYPE;
    }

    return getSupportedTaskType(taskType);
}


function getInitialEditSubTaskId(subTaskEditRequest, initialTask, isMultiPhaseTask, subTasks) {
    if (!subTaskEditRequest || !initialTask || !isMultiPhaseTask) {
        return null;
    }

    if (subTaskEditRequest.taskId !== initialTask.id) {
        return null;
    }

    const currentSubTasks = Array.isArray(subTasks) ? subTasks : [];
    const hasRequestedSubTask = currentSubTasks.some(function matchRequestedSubTask(subTask) {
        return subTask.id === subTaskEditRequest.subTaskId;
    });

    if (!hasRequestedSubTask) {
        return null;
    }

    return subTaskEditRequest.subTaskId;
}


function getInitialFormValues(task) {
    if (!task) {
        return {
            ...DEFAULT_FORM_VALUES,
        };
    }

    const taskType = getSupportedTaskType(task.taskType);
    const isReleaseTask = taskType === RELEASE_TASK_TYPE;
    const isMultiPhase = taskType === MULTI_PHASE_TASK_TYPE;

    return {
        name: task.name || "",
        description: task.description || "",
        url: task.url || "",
        assignee: task.assignee || UNASSIGNED_ASSIGNEE,
        projectName: task.projectName || NO_PROJECT_NAME,
        taskType,
        taskLevel: (isReleaseTask || isMultiPhase)
            ? DEFAULT_TASK_LEVEL
            : getSupportedTaskLevel(task.taskLevel),
        startDate: isMultiPhase ? (task.startDate || "") : (task.startDate || ""),
        stopDate: isReleaseTask
            ? task.startDate || ""
            : task.stopDate || "",
        progressPercent: isReleaseTask
            ? 100
            : task.progressPercent || 0,
        parentTaskId: task.parentTaskId || "",
        subTasks: isMultiPhase ? (task.subTasks || []) : [],
    };
}


function getBulkInitialFormValues(tasks) {
    const mixedFields = getMixedFieldSet(tasks);
    const bulkValues = {};

    FORM_FIELD_NAMES.forEach(function mapBulkFieldValue(fieldName) {
        if (mixedFields.has(fieldName)) {
            bulkValues[fieldName] = getMixedFieldValue(fieldName);
            return;
        }

        bulkValues[fieldName] = getNormalizedTaskFieldValue(tasks[0], fieldName);
    });

    return bulkValues;
}


function normalizeTaskDraft(formValues) {
    if (formValues.taskType === MULTI_PHASE_TASK_TYPE) {
        const sortedSubTasks = sortSubTasksByStartDate(formValues.subTasks);
        const computed = computeMultiPhaseTaskDates(sortedSubTasks);

        return {
            name: formValues.name.trim(),
            description: formValues.description.trim(),
            url: formValues.url.trim(),
            assignee: formValues.assignee,
            projectName: formValues.projectName,
            taskType: MULTI_PHASE_TASK_TYPE,
            taskLevel: DEFAULT_TASK_LEVEL,
            parentTaskId: formValues.parentTaskId.trim(),
            subTasks: sortedSubTasks,
            ...computed,
        };
    }

    return {
        name: formValues.name.trim(),
        description: formValues.description.trim(),
        url: formValues.url.trim(),
        assignee: formValues.assignee,
        projectName: formValues.projectName,
        taskType: formValues.taskType,
        taskLevel: formValues.taskType === RELEASE_TASK_TYPE
            ? DEFAULT_TASK_LEVEL
            : formValues.taskLevel,
        startDate: formValues.startDate,
        stopDate: formValues.taskType === RELEASE_TASK_TYPE
            ? formValues.startDate
            : formValues.stopDate,
        progressPercent: formValues.taskType === RELEASE_TASK_TYPE
            ? 100
            : formValues.progressPercent,
        parentTaskId: formValues.parentTaskId.trim(),
    };
}


function normalizeBulkTaskPatch(formValues, dirtyFields) {
    const taskPatch = {};

    dirtyFields.forEach(function mapDirtyField(fieldName) {
        taskPatch[fieldName] = normalizeBulkPatchField(fieldName, formValues[fieldName]);
    });

    return taskPatch;
}


function normalizeBulkPatchField(fieldName, value) {
    if (fieldName === "progressPercent") {
        return value;
    }

    if (typeof value !== "string") {
        return value;
    }

    return value.trim();
}


function applyBulkTaskPatchPreview(task, bulkPatch) {
    const nextTaskType = bulkPatch.taskType || task.taskType;
    const nextTask = {
        ...task,
    };

    Object.entries(bulkPatch).forEach(function applyPatchField([fieldName, fieldValue]) {
        if (nextTaskType === RELEASE_TASK_TYPE && fieldName === "stopDate") {
            return;
        }

        if (nextTaskType === RELEASE_TASK_TYPE && fieldName === "progressPercent") {
            return;
        }

        if (nextTaskType === RELEASE_TASK_TYPE && fieldName === "taskLevel") {
            return;
        }

        nextTask[fieldName] = fieldValue;
    });

    if (nextTaskType === RELEASE_TASK_TYPE) {
        nextTask.taskType = RELEASE_TASK_TYPE;
        nextTask.taskLevel = DEFAULT_TASK_LEVEL;
        nextTask.stopDate = nextTask.startDate;
        nextTask.progressPercent = 100;
    }

    return nextTask;
}


function getEditTasks(initialTask, initialTasks) {
    if (initialTasks.length > 0) {
        return initialTasks;
    }

    if (initialTask) {
        return [initialTask];
    }

    return [];
}


function getMixedFieldSet(tasks) {
    const mixedFields = new Set();

    if (tasks.length <= 1) {
        return mixedFields;
    }

    FORM_FIELD_NAMES.forEach(function inspectField(fieldName) {
        const firstValue = getNormalizedTaskFieldValue(tasks[0], fieldName);
        const hasMixedValue = tasks.some(function matchDifferentFieldValue(task) {
            return getNormalizedTaskFieldValue(task, fieldName) !== firstValue;
        });

        if (hasMixedValue) {
            mixedFields.add(fieldName);
        }
    });

    return mixedFields;
}


function getNormalizedTaskFieldValue(task, fieldName) {
    if (fieldName === "assignee") {
        return task.assignee || UNASSIGNED_ASSIGNEE;
    }

    if (fieldName === "projectName") {
        return task.projectName || NO_PROJECT_NAME;
    }

    if (fieldName === "taskType") {
        return getSupportedTaskType(task.taskType);
    }

    if (fieldName === "taskLevel") {
        if (getSupportedTaskType(task.taskType) === RELEASE_TASK_TYPE) {
            return DEFAULT_TASK_LEVEL;
        }

        return getSupportedTaskLevel(task.taskLevel);
    }

    if (fieldName === "progressPercent") {
        if (task.taskType === RELEASE_TASK_TYPE) {
            return 100;
        }

        return task.progressPercent || 0;
    }

    return task[fieldName] || "";
}


function getMixedFieldValue(fieldName) {
    if (
        fieldName === "assignee"
        || fieldName === "projectName"
        || fieldName === "taskType"
        || fieldName === "taskLevel"
    ) {
        return MIXED_SELECT_VALUE;
    }

    if (fieldName === "progressPercent") {
        return 0;
    }

    if (fieldName === "startDate" || fieldName === "stopDate") {
        return "";
    }

    return MIXED_TEXT_VALUE;
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


function getProjectOptions(projectNames) {
    const projectNameOptions = projectNames.map(function mapProjectName(projectName) {
        return projectName.name;
    });

    return [
        NO_PROJECT_NAME,
        ...projectNameOptions,
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


function getUpdatedSelectedProject(selectedProject, projectUpdate) {
    const renamedProject = projectUpdate.renamedProjects.find(function matchRenamedProject(
        project,
    ) {
        return project.previousName === selectedProject;
    });

    if (renamedProject) {
        return renamedProject.nextName;
    }

    if (projectUpdate.deletedProjects.includes(selectedProject)) {
        return NO_PROJECT_NAME;
    }

    return selectedProject;
}


function getFieldHelperText(fieldName, formErrors, mixedFields, dirtyFields) {
    if (formErrors[fieldName]) {
        return formErrors[fieldName];
    }

    return "";
}


function isRequiredField(fieldName, mixedFields, dirtyFields, isBulkEditMode) {
    if (!isBulkEditMode) {
        return true;
    }

    if (mixedFields.has(fieldName) && !dirtyFields.has(fieldName)) {
        return false;
    }

    return true;
}


function formatProgressValue(value, hasMixedProgress = false, hasDirtyProgress = true) {
    if (hasMixedProgress && !hasDirtyProgress) {
        return "0%";
    }

    return `${value}%`;
}
