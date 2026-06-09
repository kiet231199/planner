import CloseIcon from "@mui/icons-material/Close";
import { Box, Drawer, IconButton, Typography } from "@mui/material";

import TaskForm from "./TaskForm";


export default function TaskDrawer(props) {
    const {
        open,
        isSaving,
        assignees,
        projectNames,
        isAssigneeSaving,
        isProjectSaving,
        mode,
        task,
        tasks = [],
        onClose,
        onCreateTask,
        onSaveAssignees,
        onSaveProjectNames,
        onUpdateTask,
        onUpdateTasks,
    } = props;

    const isEditMode = mode === "edit";
    const selectedTasks = getSelectedTasksForDrawer(task, tasks, isEditMode);
    const isBulkEditMode = selectedTasks.length > 1;
    const drawerTitle = getDrawerTitle(isEditMode, selectedTasks.length);
    const drawerDescription = getDrawerDescription(isEditMode, isBulkEditMode);

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{ className: "task-drawer-paper" }}
        >
            <Box className="task-drawer-header">
                <Box>
                    <Typography variant="h6">{drawerTitle}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {drawerDescription}
                    </Typography>
                </Box>
                <IconButton aria-label="Close drawer" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Box>
            <TaskForm
                key={getTaskFormKey(isEditMode, selectedTasks)}
                initialTask={isEditMode ? task : null}
                initialTasks={isEditMode ? selectedTasks : []}
                isSaving={isSaving}
                assignees={assignees}
                projectNames={projectNames}
                isAssigneeSaving={isAssigneeSaving}
                isProjectSaving={isProjectSaving}
                onCancel={onClose}
                onSaveAssignees={onSaveAssignees}
                onSaveProjectNames={onSaveProjectNames}
                onSubmitTask={getSubmitTaskHandler(
                    isEditMode,
                    isBulkEditMode,
                    onCreateTask,
                    onUpdateTask,
                    onUpdateTasks,
                )}
            />
        </Drawer>
    );
}


function getSelectedTasksForDrawer(task, tasks, isEditMode) {
    if (!isEditMode) {
        return [];
    }

    if (tasks.length > 0) {
        return tasks;
    }

    if (task) {
        return [task];
    }

    return [];
}


function getDrawerTitle(isEditMode, taskCount) {
    if (!isEditMode) {
        return "Add Task";
    }

    if (taskCount > 1) {
        return `Edit ${taskCount} Tasks`;
    }

    return "Edit Task";
}


function getDrawerDescription(isEditMode, isBulkEditMode) {
    if (!isEditMode) {
        return "Create a task bar for the project timeline.";
    }

    if (isBulkEditMode) {
        return "Update the selected tasks on the project timeline.";
    }

    return "Update this task on the project timeline.";
}


function getTaskFormKey(isEditMode, selectedTasks) {
    if (!isEditMode) {
        return "create";
    }

    return selectedTasks.map(function mapTaskId(task) {
        return getTaskFormKeyPart(task);
    }).join(",");
}


function getTaskFormKeyPart(task) {
    return [
        task.id,
        task.name || "",
        task.description || "",
        task.url || "",
        task.assignee || "",
        task.projectName || "",
        task.taskType || "",
        task.taskLevel || "",
        task.startDate || "",
        task.stopDate || "",
        String(task.progressPercent || 0),
    ].join("|");
}


function getSubmitTaskHandler(
    isEditMode,
    isBulkEditMode,
    onCreateTask,
    onUpdateTask,
    onUpdateTasks,
) {
    if (!isEditMode) {
        return onCreateTask;
    }

    if (isBulkEditMode) {
        return onUpdateTasks;
    }

    return onUpdateTask;
}
