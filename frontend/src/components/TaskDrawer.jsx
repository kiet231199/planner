import CloseIcon from "@mui/icons-material/Close";
import { Box, Drawer, IconButton, Typography } from "@mui/material";

import TaskForm from "./TaskForm";


export default function TaskDrawer(props) {
    const {
        open,
        isSaving,
        mode,
        task,
        onClose,
        onCreateTask,
        onUpdateTask,
    } = props;

    const isEditMode = mode === "edit";

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{ className: "task-drawer-paper" }}
        >
            <Box className="task-drawer-header">
                <Box>
                    <Typography variant="h6">{isEditMode ? "Edit Task" : "Add Task"}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {isEditMode
                            ? "Update this task on the project timeline."
                            : "Create a task bar for the project timeline."}
                    </Typography>
                </Box>
                <IconButton aria-label="Close drawer" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Box>
            <TaskForm
                key={isEditMode && task ? task.id : "create"}
                initialTask={isEditMode ? task : null}
                isSaving={isSaving}
                onCancel={onClose}
                onSubmitTask={isEditMode ? onUpdateTask : onCreateTask}
            />
        </Drawer>
    );
}
