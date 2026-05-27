import CloseIcon from "@mui/icons-material/Close";
import {
    Box,
    Drawer,
    FormControlLabel,
    IconButton,
    Switch,
    Typography,
} from "@mui/material";


export default function SettingsDrawer(props) {
    const {
        colorMode,
        open,
        onClose,
        onColorModeToggle,
    } = props;

    const isDarkMode = colorMode === "dark";

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{ className: "settings-drawer-paper" }}
        >
            <Box className="settings-drawer-header">
                <Box>
                    <Typography variant="h6">Settings</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Configure planner display options.
                    </Typography>
                </Box>
                <IconButton aria-label="Close settings" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Box>
            <Box className="settings-drawer-content">
                <FormControlLabel
                    control={(
                        <Switch
                            checked={isDarkMode}
                            onChange={onColorModeToggle}
                        />
                    )}
                    label="Dark mode"
                />
            </Box>
        </Drawer>
    );
}
