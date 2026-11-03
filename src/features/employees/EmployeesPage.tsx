import { useMemo, useState } from 'react'

import {
    Filter,
    Plus,
    Search,
    UsersRound,
} from 'lucide-react'

/**
 * D-GATE Silver CRM
 * Employees Module — Frontend
 *
 * Employee records and display configuration
 * are supplied by the parent application.
 *
 * Backend authorization determines which
 * employee records and actions are permitted.
 *
 * No mock data or API calls.
 */

export type EmployeeFieldValue =
    | string
    | number
    | boolean
    | null

export interface EmployeeColumn {
    readonly id: string
    readonly label: string
    readonly key: string
}

export interface EmployeeOption {
    readonly id: string
    readonly label: string
}

export interface EmployeeRecord {
    readonly id: string
    readonly roleId?: string | null
    readonly teamId?: string | null
    readonly statusId?: string | null
    readonly fields: Readonly<
        Record<string, EmployeeFieldValue>
    >
}

export interface EmployeesPageProps {
    readonly employees?: readonly EmployeeRecord[]
    readonly columns?: readonly EmployeeColumn[]
    readonly roles?: readonly EmployeeOption[]
    readonly teams?: readonly EmployeeOption[]
    readonly statuses?: readonly EmployeeOption[]
    readonly onCreateEmployee?: () => void
    readonly onOpenEmployee?: (
        employee: EmployeeRecord
    ) => void
}

const emptyEmployees: readonly EmployeeRecord[] = []
const emptyOptions: readonly EmployeeOption[] = []

/**
 * Default table presentation only.
 * Customer-specific display configurations
 * can replace these columns.
 */
const defaultColumns: readonly EmployeeColumn[] = [
    {
        id: 'name',
        label: 'Employee Name',
        key: 'name',
    },
    {
        id: 'email',
        label: 'Email',
        key: 'email',
    },
    {
        id: 'role',
        label: 'Role',
        key: 'role',
    },
    {
        id: 'team',
        label: 'Team',
        key: 'team',
    },
    {
        id: 'status',
        label: 'Status',
        key: 'status',
    },
]

function formatValue(
    value: EmployeeFieldValue | undefined
): string {
    if (value === null || value === undefined) {
        return '—'
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No'
    }

    return String(value)
}

function createLabelMap(
    options: readonly EmployeeOption[]
): ReadonlyMap<string, string> {
    return new Map(
        options.map((option) => [
            option.id,
            option.label,
        ])
    )
}

export default function EmployeesPage({
    employees = emptyEmployees,
    columns = defaultColumns,
    roles = emptyOptions,
    teams = emptyOptions,
    statuses = emptyOptions,
    onCreateEmployee,
    onOpenEmployee,
}: EmployeesPageProps) {
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState('')
    const [teamFilter, setTeamFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const roleLabels = useMemo(
        () => createLabelMap(roles),
        [roles]
    )

    const teamLabels = useMemo(
        () => createLabelMap(teams),
        [teams]
    )

    const statusLabels = useMemo(
        () => createLabelMap(statuses),
        [statuses]
    )

    const activeRole = roles.some(
        (role) => role.id === roleFilter
    ) ? roleFilter : ''

    const activeTeam = teams.some(
        (team) => team.id === teamFilter
    ) ? teamFilter : ''

    const activeStatus = statuses.some(
        (status) => status.id === statusFilter
    ) ? statusFilter : ''

    const visibleEmployees = useMemo(() => {
        const term = search.trim().toLowerCase()

        return employees.filter((employee) => {
            if (
                activeRole &&
                employee.roleId !== activeRole
            ) {
                return false
            }

            if (
                activeTeam &&
                employee.teamId !== activeTeam
            ) {
                return false
            }

            if (
                activeStatus &&
                employee.statusId !== activeStatus
            ) {
                return false
            }

            if (!term) {
                return true
            }

            const searchableValues = [
                employee.id,
                roleLabels.get(employee.roleId ?? ''),
                teamLabels.get(employee.teamId ?? ''),
                statusLabels.get(employee.statusId ?? ''),
                ...Object.values(employee.fields),
            ]

            return searchableValues.some((value) =>
                String(value ?? '')
                    .toLowerCase()
                    .includes(term)
            )
        })
    }, [
        employees,
        search,
        activeRole,
        activeTeam,
        activeStatus,
        roleLabels,
        teamLabels,
        statusLabels,
    ])

    function getCellValue(
        employee: EmployeeRecord,
        column: EmployeeColumn
    ): string {
        switch (column.key) {
            case 'role':
                return roleLabels.get(
                    employee.roleId ?? ''
                ) ?? '—'

            case 'team':
                return teamLabels.get(
                    employee.teamId ?? ''
                ) ?? '—'

            case 'status':
                return statusLabels.get(
                    employee.statusId ?? ''
                ) ?? '—'

            default:
                return formatValue(
                    employee.fields[column.key]
                )
        }
    }

    return (
        <div className="employees-page">
            <header className="employees-heading">
                <div>
                    <p className="employees-eyebrow">
                        D-GATE / SILVER CRM
                    </p>

                    <h1>Employees</h1>

                    <p>
                        View your team members, assigned
                        roles, and company workforce.
                    </p>
                </div>

                <button
                    type="button"
                    className="employees-create-button"
                    onClick={onCreateEmployee}
                    disabled={!onCreateEmployee}
                    title={
                        onCreateEmployee
                            ? 'Add employee'
                            : 'Employee creation is not connected yet'
                    }
                >
                    <Plus size={17} aria-hidden="true" />
                    Add Employee
                </button>
            </header>

            <section
                className="employees-panel"
                aria-label="Employee directory"
            >
                <div className="employees-panel-heading">
                    <div>
                        <h2>Employee Directory</h2>

                        <p aria-live="polite">
                            {visibleEmployees.length} of{' '}
                            {employees.length} records
                        </p>
                    </div>

                    <UsersRound
                        size={20}
                        aria-hidden="true"
                    />
                </div>

                <div className="employees-toolbar">
                    <label className="employees-search">
                        <Search size={17} aria-hidden="true" />

                        <input
                            type="search"
                            value={search}
                            aria-label="Search employees"
                            placeholder="Search employees..."
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                        />
                    </label>

                    <label className="employees-role-filter">
                        <Filter size={16} aria-hidden="true" />

                        <select
                            value={activeRole}
                            aria-label="Filter employees by role"
                            disabled={roles.length === 0}
                            onChange={(event) =>
                                setRoleFilter(event.target.value)
                            }
                        >
                            <option value="">All roles</option>

                            {roles.map((role) => (
                                <option
                                    key={role.id}
                                    value={role.id}
                                >
                                    {role.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="employees-team-filter">
                        <UsersRound
                            size={16}
                            aria-hidden="true"
                        />

                        <select
                            value={activeTeam}
                            aria-label="Filter employees by team"
                            disabled={teams.length === 0}
                            onChange={(event) =>
                                setTeamFilter(event.target.value)
                            }
                        >
                            <option value="">All teams</option>

                            {teams.map((team) => (
                                <option
                                    key={team.id}
                                    value={team.id}
                                >
                                    {team.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="employees-status-filter">
                        <Filter size={16} aria-hidden="true" />

                        <select
                            value={activeStatus}
                            aria-label="Filter employees by status"
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
                    <div className="employees-empty">
                        <UsersRound
                            size={28}
                            aria-hidden="true"
                        />

                        <h3>No columns configured</h3>

                        <p>
                            Employee display columns
                            have not been configured.
                        </p>
                    </div>
                ) : (
                    <div className="employees-table-wrap">
                        <table className="employees-table">
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
                                {visibleEmployees.map((employee) => (
                                    <tr key={employee.id}>
                                        {columns.map((column, index) => {
                                            const value = getCellValue(
                                                employee,
                                                column
                                            )

                                            return (
                                                <td key={column.id}>
                                                    {index === 0 &&
                                                    onOpenEmployee ? (
                                                        <button
                                                            type="button"
                                                            className="employees-record-link"
                                                            onClick={() =>
                                                                onOpenEmployee(
                                                                    employee
                                                                )
                                                            }
                                                            aria-label={
                                                                `Open employee ${value}`
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

                        {visibleEmployees.length === 0 && (
                            <div className="employees-empty">
                                <UsersRound
                                    size={28}
                                    aria-hidden="true"
                                />

                                <h3>
                                    {employees.length === 0
                                        ? 'No employees available'
                                        : 'No matching employees'}
                                </h3>

                                <p>
                                    {employees.length === 0
                                        ? 'Employee records will appear here once authorized data is connected.'
                                        : 'Try another search or filter.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    )
}