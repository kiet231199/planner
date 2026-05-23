import CloseIcon from "@mui/icons-material/Close";
import { Box, Drawer, IconButton, Typography } from "@mui/material";

import TaskForm from "./TaskForm";


export default function TaskDrawer(props) {
    const { open, isSaving, onClose, onCreateTask } = props;

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{ className: "task-drawer-paper" }}
        >
            <Box className="task-drawer-header">
                <Box>
                    <Typography variant="h6">Add Task</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Create a task bar for the project timeline.
                    </Typography>
                </Box>
                <IconButton aria-label="Close drawer" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Box>
            <TaskForm
                isSaving={isSaving}
                onCancel={onClose}
                onCreateTask={onCreateTask}
            />
        </Drawer>
    );
}
