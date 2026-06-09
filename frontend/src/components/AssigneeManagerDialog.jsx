import NameColorManagerDialog from "./NameColorManagerDialog";
import { DAY_OFF_ALL_ASSIGNEES, UNASSIGNED_ASSIGNEE } from "../constants/taskOptions";


const DEFAULT_NEW_ASSIGNEE_COLOR = "#1e88e5";
const RESERVED_ASSIGNEE_NAMES = new Set([
    UNASSIGNED_ASSIGNEE.toLocaleLowerCase(),
    DAY_OFF_ALL_ASSIGNEES.toLocaleLowerCase(),
]);
const ASSIGNEE_MANAGER_LABELS = {
    title: "Manage assignees",
    nameColumn: "Name",
    tableAriaLabel: "Assignee table",
    selectAllAriaLabel: "Select all assignees",
    emptyMessage: "No assignees",
    warningTitle: "Update assignee references?",
    warningMessage: "Referenced tasks and day-offs will be affected by this assignee change.",
    defaultNewColor: DEFAULT_NEW_ASSIGNEE_COLOR,
    getRowSelectAriaLabel: getAssigneeRowSelectAriaLabel,
};
const ASSIGNEE_UPDATE_KEYS = {
    items: "assignees",
    renamedItems: "renamedAssignees",
    deletedItems: "deletedAssignees",
};


export default function AssigneeManagerDialog(props) {
    const {
        open,
        assignees = [],
        isSaving,
        onClose,
        onSave,
    } = props;

    return (
        <NameColorManagerDialog
            open={open}
            items={assignees}
            isSaving={isSaving}
            labels={ASSIGNEE_MANAGER_LABELS}
            reservedNames={RESERVED_ASSIGNEE_NAMES}
            updateKeys={ASSIGNEE_UPDATE_KEYS}
            onClose={onClose}
            onSave={onSave}
        />
    );
}


function getAssigneeRowSelectAriaLabel(name) {
    return `Select ${name || "assignee"}`;
}
