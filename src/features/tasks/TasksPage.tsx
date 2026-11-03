import { useMemo, useState } from 'react'

import {
    CalendarClock,
    ClipboardCheck,
    Filter,
    Plus,
    Search,
} from 'lucide-react'

/**
 * D-GATE Silver CRM
 * Tasks & Follow-ups — Frontend
 *
 * Records, task types, statuses, priorities,
 * and display columns are configuration-driven.
 *
 * No API calls or database operations.
 */

export type TaskFieldValue =
    | string
    | number
    | boolean
    | null

export interface TaskColumn {
    readonly id: string
    readonly label: string
    readonly key: string
}

export interface TaskOption {
    readonly id: string
    readonly label: string
}

export interface TaskRecord {
    readonly id: string
    readonly typeId?: string | null
    readonly statusId?: string | null
    readonly priorityId?: string | null
    readonly fields: Readonly<
        Record<string, TaskFieldValue>
    >
}

export interface TasksPageProps {
    readonly tasks?: readonly TaskRecord[]
    readonly columns?: readonly TaskColumn[]
    readonly types?: readonly TaskOption[]
    readonly statuses?: readonly TaskOption[]
    readonly priorities?: readonly TaskOption[]
    readonly onCreateTask?: () => void
    readonly onOpenTask?: (task: TaskRecord) => void
}

/*
 * Initial display columns only.
 * Customers may configure their own fields
 * and column layout.
 */
const defaultColumns: readonly TaskColumn[] = [
    {
        id: 'title',
        label: 'Task / Follow-up',
        key: 'title',
    },
    {
        id: 'type',
        label: 'Type',
        key: 'type',
    },
    {
        id: 'due-date',
        label: 'Due Date',
        key: 'dueDate',
    },
    {
        id: 'priority',
        label: 'Priority',
        key: 'priority',
    },
    {
        id: 'status',
        label: 'Status',
        key: 'status',
    },
    {
        id: 'assigned-to',
        label: 'Assigned To',
        key: 'owner',
    },
    {
        id: 'related-to',
        label: 'Related To',
        key: 'relatedTo',
    },
]

function formatValue(
    value: TaskFieldValue | undefined
): string {
    if (value === undefined || value === null) {
        return '—'
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No'
    }

    return String(value)
}

function createLabelMap(
    options: readonly TaskOption[]
): ReadonlyMap<string, string> {
    return new Map(
        options.map((option) => [
            option.id,
            option.label,
        ])
    )
}

export default function TasksPage({
    tasks = [],
    columns = defaultColumns,
    types = [],
    statuses = [],
    priorities = [],
    onCreateTask,
    onOpenTask,
}: TasksPageProps) {
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const typeLabels = useMemo(
        () => createLabelMap(types),
        [types]
    )

    const statusLabels = useMemo(
        () => createLabelMap(statuses),
        [statuses]
    )

    const priorityLabels = useMemo(
        () => createLabelMap(priorities),
        [priorities]
    )

    const visibleTasks = useMemo(() => {
        const term = search.trim().toLowerCase()

        return tasks.filter((task) => {
            if (
                typeFilter &&
                task.typeId !== typeFilter
            ) {
                return false
            }

            if (
                statusFilter &&
                task.statusId !== statusFilter
            ) {
                return false
            }

            if (!term) {
                return true
            }

            const searchableValues = [
                task.id,
                typeLabels.get(task.typeId ?? ''),
                statusLabels.get(task.statusId ?? ''),
                priorityLabels.get(task.priorityId ?? ''),
                ...Object.values(task.fields),
            ]

            return searchableValues.some((value) =>
                String(value ?? '')
                    .toLowerCase()
                    .includes(term)
            )
        })
    }, [
        tasks,
        search,
        typeFilter,
        statusFilter,
        typeLabels,
        statusLabels,
        priorityLabels,
    ])

    function getCellValue(
        task: TaskRecord,
        column: TaskColumn
    ): string {
        if (column.key === 'type') {
            return (
                typeLabels.get(task.typeId ?? '') ?? '—'
            )
        }

        if (column.key === 'status') {
            return (
                statusLabels.get(task.statusId ?? '') ?? '—'
            )
        }

        if (column.key === 'priority') {
            return (
                priorityLabels.get(task.priorityId ?? '') ?? '—'
            )
        }

        return formatValue(task.fields[column.key])
    }

    return (
        <div className="tasks-page">
            <header className="tasks-heading">
                <div>
                    <p className="tasks-eyebrow">
                        D-GATE / SILVER CRM
                    </p>

                    <h1>Tasks &amp; Follow-ups</h1>

                    <p>
                        Organize assigned tasks, scheduled
                        follow-ups, and upcoming activities.
                    </p>
                </div>

                <button
                    type="button"
                    className="tasks-create-button"
                    onClick={onCreateTask}
                    disabled={!onCreateTask}
                    title={
                        onCreateTask
                            ? 'Create task or follow-up'
                            : 'Task creation is not connected yet'
                    }
                >
                    <Plus size={17} aria-hidden="true" />
                    New Task
                </button>
            </header>

            <section
                className="tasks-panel"
                aria-label="Tasks and follow-ups records"
            >
                <div className="tasks-panel-heading">
                    <div>
                        <h2>All Tasks &amp; Follow-ups</h2>

                        <p aria-live="polite">
                            {visibleTasks.length} of{' '}
                            {tasks.length} records
                        </p>
                    </div>

                    <ClipboardCheck
                        size={20}
                        aria-hidden="true"
                    />
                </div>

                <div className="tasks-toolbar">
                    <label className="tasks-search">
                        <Search size={17} aria-hidden="true" />

                        <input
                            type="search"
                            aria-label="Search tasks and follow-ups"
                            placeholder="Search tasks and follow-ups..."
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                        />
                    </label>

                    <label className="tasks-type-filter">
                        <CalendarClock
                            size={16}
                            aria-hidden="true"
                        />

                        <select
                            aria-label="Filter by activity type"
                            value={typeFilter}
                            disabled={types.length === 0}
                            onChange={(event) =>
                                setTypeFilter(event.target.value)
                            }
                        >
                            <option value="">All types</option>

                            {types.map((type) => (
                                <option
                                    key={type.id}
                                    value={type.id}
                                >
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="tasks-status-filter">
                        <Filter
                            size={16}
                            aria-hidden="true"
                        />

                        <select
                            aria-label="Filter by task status"
                            value={statusFilter}
                            disabled={statuses.length === 0}
                            onChange={(event) =>
                                setStatusFilter(event.target.value)
                            }
                        >
                            <option value="">All statuses</option>

                            {statuses.map((status) => (
                                <option
                                    key={status.id}
                                    value={status.id}
                                >
                                    {status.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {columns.length === 0 ? (
                    <div className="tasks-empty">
                        <ClipboardCheck
                            size={28}
                            aria-hidden="true"
                        />

                        <h3>No columns configured</h3>

                        <p>
                            Task display columns have
                            not been configured.
                        </p>
                    </div>
                ) : (
                    <div className="tasks-table-wrap">
                        <table className="tasks-table">
                            <thead>
                                <tr>
                                    {columns.map((column) => (
                                        <th
                                            key={column.id}
                                            scope="col"
                                        >
                                            {column.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {visibleTasks.map((task) => (
                                    <tr key={task.id}>
                                        {columns.map((column, index) => {
                                            const value = getCellValue(
                                                task,
                                                column
                                            )

                                            return (
                                                <td key={column.id}>
                                                    {index === 0 &&
                                                    onOpenTask ? (
                                                        <button
                                                            type="button"
                                                            className="tasks-record-link"
                                                            onClick={() =>
                                                                onOpenTask(task)
                                                            }
                                                            aria-label={
                                                                `Open task ${value}`
                                                            }
                                                        >
                                                            {value}
                                                        </button>
                                                    ) : (
                                                        value
                                                    )}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {visibleTasks.length === 0 && (
                            <div className="tasks-empty">
                                <ClipboardCheck
                                    size={28}
                                    aria-hidden="true"
                                />

                                <h3>
                                    {tasks.length === 0
                                        ? 'No tasks or follow-ups available'
                                        : 'No matching activities'}
                                </h3>

                                <p>
                                    {tasks.length === 0
                                        ? 'Your tasks and follow-ups will appear here once data is connected.'
                                        : 'Try another search, activity type, or status filter.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    )
}