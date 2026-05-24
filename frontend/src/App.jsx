import { useEffect, useState } from "react";
import { Alert, Box, CssBaseline, Snackbar, ThemeProvider, createTheme } from "@mui/material";

import { createTask, deleteTask, listTasks } from "./api/tasksClient";
import PlannerShell from "./components/PlannerShell";
import { DEFAULT_ZOOM_INDEX, MAX_ZOOM_INDEX, MIN_ZOOM_INDEX } from "./utils/chartScale";


const theme = createTheme({
    palette: {
        primary: {
            main: "#1565c0",
        },
        background: {
            default: "#f6f8fb",
        },
    },
    shape: {
        borderRadius: 6,
    },
});

export default function App() {
    const [tasks, setTasks] = useState([]);
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);

    useEffect(function loadInitialTasks() {
        loadTasks();
    }, []);

    async function loadTasks() {
        setIsLoading(true);

        try {
            const loadedTasks = await listTasks();
            setTasks(loadedTasks);
            clearMissingSelection(loadedTasks);
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleCreateTask(taskDraft) {
        setIsSaving(true);

        try {
            const createdTask = await createTask(taskDraft);
            setTasks(function appendTask(currentTasks) {
                return [...currentTasks, createdTask].sort(sortTasks);
            });
            setSelectedTaskId(createdTask.id);
            setIsDrawerOpen(false);
            return true;
        } catch (error) {
            setErrorMessage(error.message);
            return false;
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDeleteSelectedTask() {
        if (!selectedTaskId) {
            return;
        }

        setIsSaving(true);

        try {
            await deleteTask(selectedTaskId);
            setTasks(function removeTask(currentTasks) {
                return currentTasks.filter(function keepTask(task) {
                    return task.id !== selectedTaskId;
                });
            });
            setSelectedTaskId(null);
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setIsSaving(false);
        }
    }

    function handleTimelineZoom(zoomDirection) {
        setZoomIndex(function updateZoom(currentZoomIndex) {
            const nextZoomIndex = currentZoomIndex + zoomDirection;

            return Math.min(Math.max(nextZoomIndex, MIN_ZOOM_INDEX), MAX_ZOOM_INDEX);
        });
    }

    function clearMissingSelection(loadedTasks) {
        setSelectedTaskId(function clearSelection(currentSelectedTaskId) {
            const hasSelectedTask = loadedTasks.some(function matchTask(task) {
                return task.id === currentSelectedTaskId;
            });

            if (hasSelectedTask) {
                return currentSelectedTaskId;
            }

            return null;
        });
    }

    function closeErrorMessage() {
        setErrorMessage("");
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box className="app-root">
                <PlannerShell
                    tasks={tasks}
                    selectedTaskId={selectedTaskId}
                    isDrawerOpen={isDrawerOpen}
                    isLoading={isLoading}
                    isSaving={isSaving}
                    zoomIndex={zoomIndex}
                    onAddTaskClick={function openDrawer() {
                        setIsDrawerOpen(true);
                    }}
                    onDrawerClose={function closeDrawer() {
                        setIsDrawerOpen(false);
                    }}
                    onCreateTask={handleCreateTask}
                    onDeleteSelectedTask={handleDeleteSelectedTask}
                    onSelectTask={setSelectedTaskId}
                    onTimelineZoom={handleTimelineZoom}
                />
                <Snackbar
                    open={Boolean(errorMessage)}
                    autoHideDuration={6000}
                    onClose={closeErrorMessage}
                >
                    <Alert severity="error" variant="filled" onClose={closeErrorMessage}>
                        {errorMessage}
                    </Alert>
                </Snackbar>
            </Box>
        </ThemeProvider>
    );
}


function sortTasks(firstTask, secondTask) {
    if (firstTask.startDate === secondTask.startDate) {
        return firstTask.name.localeCompare(secondTask.name);
    }

    return firstTask.startDate.localeCompare(secondTask.startDate);
}
