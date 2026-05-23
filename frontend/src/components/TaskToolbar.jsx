import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Box, Button, Typography } from "@mui/material";


export default function TaskToolbar(props) {
    const {
        hasSelectedTask,
        isSaving,
        onAddTaskClick,
        onDeleteSelectedTask,
    } = props;

    return (
        <Box component="header" className="task-toolbar">
            <Box className="toolbar-title-group">
                <Typography variant="h6" component="h1" className="toolbar-title">
                    Project Planner
                </Typography>
            </Box>
            <Box className="toolbar-actions">
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    disabled={isSaving}
                    onClick={onAddTaskClick}
                >
                    Add Task
                </Button>
                <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteOutlineIcon />}
                    disabled={!hasSelectedTask || isSaving}
                    onClick={onDeleteSelectedTask}
                >
                    Remove
                </Button>
            </Box>
        </Box>
    );
}
