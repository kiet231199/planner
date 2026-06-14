import {
    MULTI_PHASE_TASK_TYPE,
    RELEASE_TASK_TYPE,
} from "../constants/taskOptions";


const EMPTY_CHILD_TASKS = [];
const PERCENT_DIVISOR = 100;


export function canTaskHaveChildTasks(task) {
    return Boolean(task)
        && task.taskType !== RELEASE_TASK_TYPE
        && task.taskType !== MULTI_PHASE_TASK_TYPE;
}


export function getTaskChildIds(task) {
    if (!task || !Array.isArray(task.childTasks)) {
        return EMPTY_CHILD_TASKS;
    }

    return task.childTasks
        .map(function mapChildTaskId(childTask) {
            return childTask?.id || "";
        })
        .filter(function keepChildTaskId(childTaskId) {
            return Boolean(childTaskId);
        });
}


export function hasTaskChildren(task) {
    return getTaskChildIds(task).length > 0;
}


export function getTaskHierarchyInfo(tasks) {
    const taskById = new Map();
    const childrenByParentId = new Map();
    const parentIdByChildId = new Map();
    const taskDepthById = new Map();
    const topLevelTasks = [];

    tasks.forEach(function mapTask(task) {
        taskById.set(task.id, task);
    });

    tasks.forEach(function mapTaskChildren(task) {
        if (!canTaskHaveChildTasks(task)) {
            return;
        }

        getTaskChildIds(task).forEach(function mapChildTask(childTaskId) {
            if (!taskById.has(childTaskId) || parentIdByChildId.has(childTaskId)) {
                return;
            }

            parentIdByChildId.set(childTaskId, task.id);

            if (!childrenByParentId.has(task.id)) {
                childrenByParentId.set(task.id, []);
            }

            childrenByParentId.get(task.id).push(taskById.get(childTaskId));
        });
    });

    tasks.forEach(function mapTopLevelTask(task) {
        if (!parentIdByChildId.has(task.id)) {
            topLevelTasks.push(task);
        }
    });

    topLevelTasks.forEach(function mapTaskDepth(task) {
        assignTaskDepth(task.id, 0, childrenByParentId, taskDepthById);
    });

    return {
        taskById,
        childrenByParentId,
        parentIdByChildId,
        taskDepthById,
        topLevelTasks,
    };
}


export function flattenTaskHierarchy(tasks) {
    const hierarchyInfo = getTaskHierarchyInfo(tasks);
    const flattenedTasks = [];

    hierarchyInfo.topLevelTasks.forEach(function appendTopLevelTask(task) {
        appendTaskWithChildren(task, hierarchyInfo.childrenByParentId, flattenedTasks);
    });

    return flattenedTasks;
}


export function normalizeTaskHierarchy(tasks) {
    const hierarchyInfo = getTaskHierarchyInfo(tasks);
    const normalizedTaskById = new Map();
    const visitingTaskIds = new Set();

    tasks.forEach(function normalizeTask(task) {
        normalizeTaskForHierarchy(
            task,
            hierarchyInfo.childrenByParentId,
            normalizedTaskById,
            visitingTaskIds,
        );
    });

    return flattenTaskHierarchy(tasks).map(function mapNormalizedTask(task) {
        return normalizedTaskById.get(task.id) || task;
    });
}


export function getTaskDescendantIds(tasks, taskId) {
    const hierarchyInfo = getTaskHierarchyInfo(tasks);
    const descendantIds = [];

    appendTaskDescendantIds(taskId, hierarchyInfo.childrenByParentId, descendantIds);

    return descendantIds;
}


export function getTaskTreeIds(tasks, taskId) {
    return [taskId, ...getTaskDescendantIds(tasks, taskId)];
}


export function getParentTaskId(tasks, childTaskId) {
    return getTaskHierarchyInfo(tasks).parentIdByChildId.get(childTaskId) || null;
}


export function isValidParentTaskId(tasks, childTaskId, parentTaskId) {
    if (!parentTaskId) {
        return true;
    }

    const hierarchyInfo = getTaskHierarchyInfo(tasks);
    const parentTask = hierarchyInfo.taskById.get(parentTaskId);

    if (!parentTask || !canTaskHaveChildTasks(parentTask) || childTaskId === parentTaskId) {
        return false;
    }

    return !getTaskDescendantIds(tasks, childTaskId).includes(parentTaskId);
}


export function setTaskParentId(tasks, childTaskIds, parentTaskId) {
    return setTaskParentIdAtIndex(tasks, childTaskIds, parentTaskId, null);
}


export function setTaskParentIdAtIndex(tasks, childTaskIds, parentTaskId, childIndex) {
    const childTaskIdSet = new Set(childTaskIds);

    return tasks.map(function updateTaskParent(task) {
        if (!canTaskHaveChildTasks(task)) {
            return removeTaskChildren(task);
        }

        const existingChildIds = getTaskChildIds(task).filter(function keepExistingChildId(
            childTaskId,
        ) {
            return !childTaskIdSet.has(childTaskId);
        });
        const nextChildIds = task.id === parentTaskId
            ? insertChildTaskIds(existingChildIds, childTaskIds, childIndex)
            : existingChildIds;

        return setTaskChildIds(task, nextChildIds);
    });
}


export function addTaskChildId(tasks, parentTaskId, childTaskId) {
    return tasks.map(function addChildToTask(task) {
        if (!canTaskHaveChildTasks(task)) {
            return removeTaskChildren(task);
        }

        const existingChildIds = getTaskChildIds(task).filter(function keepOtherChildId(
            existingChildId,
        ) {
            return existingChildId !== childTaskId;
        });
        const nextChildIds = task.id === parentTaskId
            ? [...existingChildIds, childTaskId]
            : existingChildIds;

        return setTaskChildIds(task, nextChildIds);
    });
}


export function cloneTasksWithHierarchyIds(tasks, createTaskId) {
    const taskIdMap = new Map();

    tasks.forEach(function mapClonedTaskId(task) {
        taskIdMap.set(task.id, createTaskId());
    });

    return tasks.map(function cloneTaskWithHierarchyIds(task) {
        const clonedTask = {
            ...task,
            id: taskIdMap.get(task.id),
        };
        const clonedChildIds = getTaskChildIds(task)
            .filter(function keepCopiedChild(childTaskId) {
                return taskIdMap.has(childTaskId);
            })
            .map(function mapCopiedChild(childTaskId) {
                return taskIdMap.get(childTaskId);
            });

        if (clonedChildIds.length > 0 && canTaskHaveChildTasks(clonedTask)) {
            clonedTask.childTasks = clonedChildIds.map(function mapChildTask(childTaskId) {
                return { id: childTaskId };
            });
        } else {
            delete clonedTask.childTasks;
        }

        return clonedTask;
    });
}


export function getTaskIdsWithDescendants(tasks, taskIds) {
    const taskIdSet = new Set();

    taskIds.forEach(function addTaskTree(taskId) {
        getTaskTreeIds(tasks, taskId).forEach(function addTaskTreeId(treeTaskId) {
            taskIdSet.add(treeTaskId);
        });
    });

    return tasks
        .filter(function keepTaskInTree(task) {
            return taskIdSet.has(task.id);
        })
        .map(function mapTaskId(task) {
            return task.id;
        });
}


export function getTaskDepth(task, fallbackDepth = 0) {
    if (!task || typeof task.__hierarchyDepth !== "number") {
        return fallbackDepth;
    }

    return task.__hierarchyDepth;
}


export function withTaskHierarchyDepth(tasks) {
    const hierarchyInfo = getTaskHierarchyInfo(tasks);

    return tasks.map(function mapTaskDepth(task) {
        return {
            ...task,
            __hierarchyDepth: hierarchyInfo.taskDepthById.get(task.id) || 0,
        };
    });
}


function assignTaskDepth(taskId, depth, childrenByParentId, taskDepthById) {
    taskDepthById.set(taskId, depth);

    const childTasks = childrenByParentId.get(taskId) || [];

    childTasks.forEach(function assignChildTaskDepth(childTask) {
        assignTaskDepth(childTask.id, depth + 1, childrenByParentId, taskDepthById);
    });
}


function appendTaskWithChildren(task, childrenByParentId, flattenedTasks) {
    flattenedTasks.push(task);

    const childTasks = childrenByParentId.get(task.id) || [];

    childTasks.forEach(function appendChildTask(childTask) {
        appendTaskWithChildren(childTask, childrenByParentId, flattenedTasks);
    });
}


function normalizeTaskForHierarchy(
    task,
    childrenByParentId,
    normalizedTaskById,
    visitingTaskIds,
) {
    if (normalizedTaskById.has(task.id)) {
        return normalizedTaskById.get(task.id);
    }

    if (visitingTaskIds.has(task.id)) {
        normalizedTaskById.set(task.id, removeTaskChildren(task));
        return normalizedTaskById.get(task.id);
    }

    visitingTaskIds.add(task.id);

    const childTasks = childrenByParentId.get(task.id) || [];
    const normalizedChildren = childTasks.map(function normalizeChildTask(childTask) {
        return normalizeTaskForHierarchy(
            childTask,
            childrenByParentId,
            normalizedTaskById,
            visitingTaskIds,
        );
    });
    const normalizedTask = getNormalizedTaskWithComputedChildren(task, normalizedChildren);

    visitingTaskIds.delete(task.id);
    normalizedTaskById.set(task.id, normalizedTask);

    return normalizedTask;
}


function getNormalizedTaskWithComputedChildren(task, childTasks) {
    if (!canTaskHaveChildTasks(task)) {
        return removeTaskChildren(task);
    }

    if (childTasks.length === 0) {
        return removeTaskChildren(task);
    }

    const computedValues = computeParentTaskValues(childTasks);

    return {
        ...task,
        childTasks: childTasks.map(function mapChildTask(childTask) {
            return { id: childTask.id };
        }),
        ...computedValues,
    };
}


function computeParentTaskValues(childTasks) {
    let startDate = childTasks[0].startDate;
    let stopDate = getEffectiveTaskStopDate(childTasks[0]);
    let totalDays = 0;
    let weightedProgress = 0;

    childTasks.forEach(function accumulateChildTask(childTask) {
        if (childTask.startDate < startDate) {
            startDate = childTask.startDate;
        }

        const childStopDate = getEffectiveTaskStopDate(childTask);

        if (childStopDate > stopDate) {
            stopDate = childStopDate;
        }

        const durationDays = getInclusiveDateStringDays(childTask.startDate, childStopDate);

        totalDays += durationDays;
        weightedProgress += (childTask.progressPercent || 0) * durationDays;
    });

    return {
        startDate,
        stopDate,
        progressPercent: totalDays > 0
            ? Math.round(weightedProgress / totalDays)
            : 0,
    };
}


function getEffectiveTaskStopDate(task) {
    if (task.taskType === RELEASE_TASK_TYPE) {
        return task.startDate;
    }

    return task.stopDate;
}


function getInclusiveDateStringDays(startDate, stopDate) {
    const startTime = Date.parse(startDate);
    const stopTime = Date.parse(stopDate);

    if (Number.isNaN(startTime) || Number.isNaN(stopTime)) {
        return 1;
    }

    return Math.max(1, Math.round((stopTime - startTime) / 86400000) + 1);
}


function appendTaskDescendantIds(taskId, childrenByParentId, descendantIds) {
    const childTasks = childrenByParentId.get(taskId) || [];

    childTasks.forEach(function appendChildTaskId(childTask) {
        descendantIds.push(childTask.id);
        appendTaskDescendantIds(childTask.id, childrenByParentId, descendantIds);
    });
}


function removeTaskChildren(task) {
    if (!task.childTasks) {
        return task;
    }

    const {
        childTasks: _removedChildTasks,
        ...taskWithoutChildren
    } = task;

    return taskWithoutChildren;
}


function setTaskChildIds(task, childTaskIds) {
    const uniqueChildTaskIds = Array.from(new Set(childTaskIds)).filter(function keepChildTaskId(
        childTaskId,
    ) {
        return Boolean(childTaskId) && childTaskId !== task.id;
    });

    if (uniqueChildTaskIds.length === 0) {
        return removeTaskChildren(task);
    }

    return {
        ...task,
        childTasks: uniqueChildTaskIds.map(function mapChildTask(childTaskId) {
            return { id: childTaskId };
        }),
    };
}


function insertChildTaskIds(existingChildIds, childTaskIds, childIndex) {
    if (childIndex === null || childIndex === undefined) {
        return [...existingChildIds, ...childTaskIds];
    }

    const clampedChildIndex = Math.min(
        Math.max(childIndex, 0),
        existingChildIds.length,
    );

    return [
        ...existingChildIds.slice(0, clampedChildIndex),
        ...childTaskIds,
        ...existingChildIds.slice(clampedChildIndex),
    ];
}
