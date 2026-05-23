import { useState } from "react";
import {
    Box,
    Button,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    Slider,
    TextField,
    Typography,
} from "@mui/material";


const ASSIGNEE_OPTIONS = ["Unassigned", "Alice", "Bob", "Charlie"];
const TASK_TYPE_OPTIONS = ["Planning", "Design", "Development", "Testing", "Release"];
const TASK_LEVEL_OPTIONS = ["", "Low", "Medium", "High"];

const DEFAULT_FORM_VALUES = {
    name: "",
    description: "",
    url: "",
    assignee: "Unassigned",
    taskType: "Planning",
    taskLevel: "",
    startDate: "",
    stopDate: "",
    progressPercent: 0,
};


export default function TaskForm(props) {
    const { isSaving, onCancel, onCreateTask } = props;
    const [formValues, setFormValues] = useState(DEFAULT_FORM_VALUES);
    const [formErrors, setFormErrors] = useState({});

    function handleTextChange(event) {
        const { name, value } = event.target;

        setFormValues(function updateFormValues(currentValues) {
            return {
                ...currentValues,
                [name]: value,
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

        const wasCreated = await onCreateTask(normalizeTaskDraft(formValues));

        if (wasCreated) {
            resetForm();
        }
    }

    function handleCancel() {
        resetForm();
        onCancel();
    }

    function resetForm() {
        setFormValues(DEFAULT_FORM_VALUES);
        setFormErrors({});
    }

    return (
        <Box component="form" className="task-form" onSubmit={handleSubmit}>
            <TextField
                label="Task name"
                name="name"
                value={formValues.name}
                error={Boolean(formErrors.name)}
                helperText={formErrors.name}
                required
                fullWidth
                onChange={handleTextChange}
            />
            <TextField
                label="Task description"
                name="description"
                value={formValues.description}
                multiline
                minRows={3}
                fullWidth
                onChange={handleTextChange}
            />
            <TextField
                label="URL"
                name="url"
                value={formValues.url}
                fullWidth
                onChange={handleTextChange}
            />
            <FormControl fullWidth>
                <InputLabel id="assignee-label">Assignee</InputLabel>
                <Select
                    labelId="assignee-label"
                    label="Assignee"
                    name="assignee"
                    value={formValues.assignee}
                    onChange={handleTextChange}
                >
                    {ASSIGNEE_OPTIONS.map(function renderAssignee(option) {
                        return (
                            <MenuItem key={option} value={option}>
                                {option}
                            </MenuItem>
                        );
                    })}
                </Select>
            </FormControl>
            <FormControl fullWidth required error={Boolean(formErrors.taskType)}>
                <InputLabel id="task-type-label">Task type</InputLabel>
                <Select
                    labelId="task-type-label"
                    label="Task type"
                    name="taskType"
                    value={formValues.taskType}
                    onChange={handleTextChange}
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
                    onChange={handleTextChange}
                >
                    {TASK_LEVEL_OPTIONS.map(function renderTaskLevel(option) {
                        const label = option || "None";

                        return (
                            <MenuItem key={label} value={option}>
                                {label}
                            </MenuItem>
                        );
                    })}
                </Select>
            </FormControl>
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
                    onChange={handleTextChange}
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
                    onChange={handleTextChange}
                />
            </Box>
            <Box>
                <Typography gutterBottom>
                    Progress: {formValues.progressPercent}%
                </Typography>
                <Slider
                    value={formValues.progressPercent}
                    min={0}
                    max={100}
                    step={5}
                    marks={[
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
                    ]}
                    onChange={handleProgressChange}
                />
            </Box>
            <Box className="task-form-actions">
                <Button variant="text" disabled={isSaving} onClick={handleCancel}>
                    Cancel
                </Button>
                <Button variant="contained" type="submit" disabled={isSaving}>
                    Save
                </Button>
            </Box>
        </Box>
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

    if (!formValues.stopDate) {
        errors.stopDate = "Stop date is required.";
    }

    if (formValues.startDate && formValues.stopDate && formValues.stopDate < formValues.startDate) {
        errors.stopDate = "Stop date must be on or after start date.";
    }

    return errors;
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
        stopDate: formValues.stopDate,
        progressPercent: formValues.progressPercent,
    };
}
