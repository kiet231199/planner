import NameColorManagerDialog from "./NameColorManagerDialog";


const PROJECT_COLOR_PALETTE = [
    "#1e88e5",
    "#8e24aa",
    "#43a047",
    "#fb8c00",
    "#d81b60",
    "#00897b",
    "#5e35b1",
    "#fdd835",
];
const PROJECT_MANAGER_LABELS = {
    title: "Manage project",
    nameColumn: "Project name",
    tableAriaLabel: "Project table",
    selectAllAriaLabel: "Select all projects",
    emptyMessage: "No projects",
    warningTitle: "Update project references?",
    warningMessage: "Referenced tasks will be affected by this project change.",
    getDefaultNewColor: getDefaultNewProjectColor,
    getRowSelectAriaLabel: getProjectRowSelectAriaLabel,
};
const PROJECT_UPDATE_KEYS = {
    items: "project_name",
    renamedItems: "renamedProjects",
    deletedItems: "deletedProjects",
};


export default function ProjectManagerDialog(props) {
    const {
        open,
        projectNames = [],
        isSaving,
        onClose,
        onSave,
    } = props;

    return (
        <NameColorManagerDialog
            open={open}
            items={projectNames}
            isSaving={isSaving}
            labels={PROJECT_MANAGER_LABELS}
            updateKeys={PROJECT_UPDATE_KEYS}
            onClose={onClose}
            onSave={onSave}
        />
    );
}


function getDefaultNewProjectColor(currentRows) {
    return PROJECT_COLOR_PALETTE[currentRows.length % PROJECT_COLOR_PALETTE.length];
}


function getProjectRowSelectAriaLabel(name) {
    return `Select ${name || "project"}`;
}
