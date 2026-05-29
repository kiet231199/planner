import { useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import {
    Box,
    Button,
    Checkbox,
    Drawer,
    FormControl,
    FormHelperText,
    IconButton,
    InputLabel,
    ListItemText,
    MenuItem,
    Select,
    TextField,
    Typography,
} from "@mui/material";

import { ASSIGNEE_OPTIONS, DAY_OFF_ALL_ASSIGNEES } from "../constants/taskOptions";


const DAY_OFF_ASSIGNEE_OPTIONS = [DAY_OFF_ALL_ASSIGNEES, ...ASSIGNEE_OPTIONS];

const DEFAULT_FORM_VALUES = {
    name: "",
    description: "",
    assignees: [DAY_OFF_ALL_ASSIGNEES],
};


export default function DayOffDrawer(props) {
    const {
        open,
        isSaving,
        selectedDates = [],
        onClose,
        onCreateDayOffs,
    } = props;
    const [formValues, setFormValues] = useState(DEFAULT_FORM_VALUES);
    const [formErrors, setFormErrors] = useState({});

    async function handleSubmit(event) {
        event.preventDefault();

        const nextErrors = validateForm(formValues);
        setFormErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        const wasSaved = await onCreateDayOffs({
            dates: selectedDates,
            name: formValues.name.trim(),
            description: formValues.description.trim(),
            assignees: formValues.assignees,
        });

        if (wasSaved) {
            resetForm();
        }
    }

    function handleCancel() {
        resetForm();
        onClose();
    }

    function handleTextChange(event) {
        const { name, value } = event.target;

        setFormValues(function updateFormValues(currentValues) {
            return {
                ...currentValues,
                [name]: value,
            };
        });
    }

    function handleAssigneesChange(event) {
        const nextAssignees = normalizeAssigneeSelection(
            event.target.value,
            formValues.assignees,
        );

        setFormValues(function updateFormValues(currentValues) {
            return {
                ...currentValues,
                assignees: nextAssignees,
            };
        });
    }

    function resetForm() {
        setFormValues(DEFAULT_FORM_VALUES);
        setFormErrors({});
    }

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={handleCancel}
            PaperProps={{ className: "day-off-drawer-paper" }}
        >
            <Box className="day-off-drawer-header">
                <Box>
                    <Typography variant="h6">Add Day-off</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {getSelectedDateLabel(selectedDates)}
                    </Typography>
                </Box>
                <IconButton aria-label="Close drawer" onClick={handleCancel}>
                    <CloseIcon />
                </IconButton>
            </Box>
            <Box component="form" className="day-off-form" onSubmit={handleSubmit}>
                <TextField
                    label="Day-off name"
                    name="name"
                    value={formValues.name}
                    error={Boolean(formErrors.name)}
                    helperText={formErrors.name}
                    required
                    fullWidth
                    onChange={handleTextChange}
                />
                <TextField
                    label="Description"
                    name="description"
                    value={formValues.description}
                    multiline
                    minRows={3}
                    fullWidth
                    onChange={handleTextChange}
                />
                <FormControl fullWidth required error={Boolean(formErrors.assignees)}>
                    <InputLabel id="day-off-assignee-label">Assignee</InputLabel>
                    <Select
                        labelId="day-off-assignee-label"
                        label="Assignee"
                        multiple
                        name="assignees"
                        value={formValues.assignees}
                        renderValue={renderAssigneeValue}
                        onChange={handleAssigneesChange}
                    >
                        {DAY_OFF_ASSIGNEE_OPTIONS.map(function renderAssignee(option) {
                            return (
                                <MenuItem key={option} value={option}>
                                    <Checkbox checked={formValues.assignees.includes(option)} />
                                    <ListItemText primary={option} />
                                </MenuItem>
                            );
                        })}
                    </Select>
                    {formErrors.assignees && (
                        <FormHelperText>{formErrors.assignees}</FormHelperText>
                    )}
                </FormControl>
                <Box className="day-off-form-actions">
                    <Button variant="text" disabled={isSaving} onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        type="submit"
                        disabled={isSaving || selectedDates.length === 0}
                    >
                        Save
                    </Button>
                </Box>
            </Box>
        </Drawer>
    );
}


function validateForm(formValues) {
    const errors = {};

    if (!formValues.name.trim()) {
        errors.name = "Day-off name is required.";
    }

    if (formValues.assignees.length === 0) {
        errors.assignees = "At least one assignee is required.";
    }

    return errors;
}


function normalizeAssigneeSelection(nextValue, previousValue) {
    const nextAssignees = Array.isArray(nextValue) ? nextValue : [];
    const selectedAll = nextAssignees.includes(DAY_OFF_ALL_ASSIGNEES);
    const previouslySelectedAll = previousValue.includes(DAY_OFF_ALL_ASSIGNEES);

    if (selectedAll && !previouslySelectedAll) {
        return [DAY_OFF_ALL_ASSIGNEES];
    }

    if (selectedAll && nextAssignees.length > 1) {
        return nextAssignees.filter(function keepIndividualAssignee(assignee) {
            return assignee !== DAY_OFF_ALL_ASSIGNEES;
        });
    }

    return nextAssignees;
}


function renderAssigneeValue(selectedAssignees) {
    return selectedAssignees.join(", ");
}


function getSelectedDateLabel(selectedDates) {
    if (selectedDates.length === 1) {
        return selectedDates[0];
    }

    return `${selectedDates.length} selected days`;
}
