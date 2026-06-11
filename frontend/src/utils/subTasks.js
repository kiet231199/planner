import { RELEASE_TASK_TYPE } from "../constants/taskOptions";


const EMPTY_SUB_TASK_DURATION_DAYS = 0;
const DATE_PART_RADIX = 10;
const LOCAL_DATE_MONTH_OFFSET = 1;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;


export function createClientSubTaskId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `subtask-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}


export function sortSubTasksByStartDate(subTasks) {
    return [...subTasks].sort(function compareSubTaskStartDate(firstSubTask, secondSubTask) {
        const startDateComparison = firstSubTask.startDate.localeCompare(secondSubTask.startDate);

        if (startDateComparison !== 0) {
            return startDateComparison;
        }

        return getEffectiveSubTaskStopDate(firstSubTask).localeCompare(
            getEffectiveSubTaskStopDate(secondSubTask),
        );
    });
}


export function getEffectiveSubTaskStopDate(subTask) {
    if (subTask.taskType === RELEASE_TASK_TYPE) {
        return subTask.startDate;
    }

    return subTask.stopDate;
}


export function hasSubTaskOverlap(subTasks) {
    const sortedSubTasks = sortSubTasksByStartDate(subTasks);

    for (let index = 0; index < sortedSubTasks.length - 1; index += 1) {
        const currentSubTask = sortedSubTasks[index];
        const nextSubTask = sortedSubTasks[index + 1];

        if (nextSubTask.startDate <= getEffectiveSubTaskStopDate(currentSubTask)) {
            return true;
        }
    }

    return false;
}


export function doesSubTaskOverlap(subTasks, candidateSubTask, excludedSubTaskId = null) {
    const candidateStartDate = candidateSubTask.startDate;
    const candidateStopDate = getEffectiveSubTaskStopDate(candidateSubTask);

    return subTasks.some(function checkSubTaskOverlap(subTask) {
        if (subTask.id === excludedSubTaskId) {
            return false;
        }

        return (
            candidateStartDate <= getEffectiveSubTaskStopDate(subTask)
            && candidateStopDate >= subTask.startDate
        );
    });
}


export function getSubTaskDurationDayDelta(subTask) {
    if (subTask.taskType === RELEASE_TASK_TYPE) {
        return EMPTY_SUB_TASK_DURATION_DAYS;
    }

    return getDateStringDeltaDays(subTask.startDate, subTask.stopDate);
}


function getDateStringDeltaDays(startDateString, stopDateString) {
    const startDate = parseLocalDateString(startDateString);
    const stopDate = parseLocalDateString(stopDateString);

    return Math.round((stopDate - startDate) / DAY_IN_MILLISECONDS);
}


function parseLocalDateString(dateString) {
    const [year, month, day] = dateString.split("-").map(function mapDatePart(datePart) {
        return parseInt(datePart, DATE_PART_RADIX);
    });

    return new Date(year, month - LOCAL_DATE_MONTH_OFFSET, day);
}
