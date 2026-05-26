import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RedoIcon from "@mui/icons-material/Redo";
import UndoIcon from "@mui/icons-material/Undo";
import { Box, Button, Typography } from "@mui/material";


export default function TaskToolbar(props) {
    const {
        canEditSelectedTask,
        canRedo,
        canUndo,
        hasSelectedTask,
        isSaving,
        onAddTaskClick,
        onDeleteSelectedTask,
        onEditSelectedTask,
        onRedoTaskChange,
        onUndoTaskChange,
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
                    startIcon={<EditOutlinedIcon />}
                    disabled={!canEditSelectedTask || isSaving}
                    onClick={onEditSelectedTask}
                >
                    Edit
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
                <Button
                    variant="outlined"
                    startIcon={<UndoIcon />}
                    disabled={!canUndo}
                    onClick={onUndoTaskChange}
                >
                    Undo
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<RedoIcon />}
                    disabled={!canRedo}
                    onClick={onRedoTaskChange}
                >
                    Redo
                </Button>
            </Box>
        </Box>
    );
}
