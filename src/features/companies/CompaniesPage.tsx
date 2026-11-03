import { useMemo, useState } from 'react'

import {
    Building2,
    Filter,
    Plus,
    Search,
} from 'lucide-react'

/**
 * D-GATE Silver CRM
 * Companies Module — Frontend
 *
 * Company fields, columns and statuses
 * are supplied by configuration.
 *
 * No API calls or database operations.
 */

export type CompanyFieldValue =
    | string
    | number
    | boolean
    | null

export interface CompanyColumn {
    readonly id: string
    readonly label: string
    readonly key: string
}

export interface CompanyStatus {
    readonly id: string
    readonly label: string
}

export interface CompanyRecord {
    readonly id: string
    readonly statusId?: string | null
    readonly fields: Readonly<
        Record<string, CompanyFieldValue>
    >
}

export interface CompaniesPageProps {
    readonly companies?: readonly CompanyRecord[]
    readonly columns?: readonly CompanyColumn[]
    readonly statuses?: readonly CompanyStatus[]
    readonly onCreateCompany?: () => void
}

/**
 * Default display columns only.
 * Customers may configure columns and fields.
 */
const defaultColumns: readonly CompanyColumn[] = [
    {
        id: 'company-name',
        label: 'Company Name',
        key: 'name',
    },
    {
        id: 'industry',
        label: 'Industry',
        key: 'industry',
    },
    {
        id: 'location',
        label: 'Location',
        key: 'location',
    },
    {
        id: 'owner',
        label: 'Assigned To',
        key: 'owner',
    },
]

function formatCell(
    value: CompanyFieldValue | undefined
): string {
    if (value === null || value === undefined) {
        return '—'
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No'
    }

    return String(value)
}

export default function CompaniesPage({
    companies = [],
    columns = defaultColumns,
    statuses = [],
    onCreateCompany,
}: CompaniesPageProps) {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const visibleCompanies = useMemo(() => {
        const term = search.trim().toLowerCase()

        return companies.filter((company) => {
            const status = statuses.find(
                (item) => item.id === company.statusId
            )

            const matchesStatus =
                !statusFilter ||
                company.statusId === statusFilter

            const searchableContent = [
                company.id,
                status?.label ?? '',
                ...Object.values(company.fields),
            ]
                .map((value) => String(value ?? ''))
                .join(' ')
                .toLowerCase()

            return (
                matchesStatus &&
                (!term || searchableContent.includes(term))
            )
        })
    }, [companies, search, statusFilter, statuses])

    function getCellValue(
        company: CompanyRecord,
        column: CompanyColumn
    ): string {
        if (column.key === 'status') {
            const status = statuses.find(
                (item) => item.id === company.statusId
            )

            return status?.label ?? '—'
        }

        return formatCell(
            company.fields[column.key]
        )
    }

    return (
        <div className="companies-page">
            <header className="companies-heading">
                <div>
                    <p className="companies-eyebrow">
                        D-GATE / SILVER CRM
                    </p>

                    <h1>Companies</h1>

                    <p>
                        Organize business accounts,
                        customer relationships, and
                        associated company records.
                    </p>
                </div>

                <button
                    type="button"
                    className="companies-create-button"
                    onClick={onCreateCompany}
                    disabled={!onCreateCompany}
                    title={
                        onCreateCompany
                            ? 'Create company'
                            : 'Company creation is not connected yet'
                    }
                >
                    <Plus
                        size={17}
                        aria-hidden="true"
                    />

                    New Company
                </button>
            </header>

            <section
                className="companies-panel"
                aria-label="Company records"
            >
                <div className="companies-panel-heading">
                    <div>
                        <h2>All Companies</h2>

                        <p aria-live="polite">
                            {visibleCompanies.length} of{' '}
                            {companies.length} records
                        </p>
                    </div>

                    <Building2
                        size={20}
                        aria-hidden="true"
                    />
                </div>

                <div className="companies-toolbar">
                    <label className="companies-search">
                        <Search
                            size={17}
                            aria-hidden="true"
                        />

                        <input
                            type="search"
                            value={search}
                            placeholder="Search companies..."
                            aria-label="Search companies"
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                        />
                    </label>

                    <label className="companies-status-filter">
                        <Filter
                            size={16}
                            aria-hidden="true"
                        />

                        <select
                            aria-label="Filter companies by status"
                            value={statusFilter}
                            disabled={statuses.length === 0}
                            onChange={(event) =>
                                setStatusFilter(
                                    event.target.value
                                )
                            }
                        >
                            <option value="">
                                All statuses
                            </option>

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
                    <div className="companies-empty">
                        <Building2
                            size={27}
                            aria-hidden="true"
                        />

                        <h3>No columns configured</h3>

                        <p>
                            Company display columns
                            have not been configured.
                        </p>
                    </div>
                ) : (
                    <div className="companies-table-wrap">
                        <table className="companies-table">
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
                                {visibleCompanies.map((company) => (
                                    <tr key={company.id}>
                                        {columns.map((column) => (
                                            <td key={column.id}>
                                                {getCellValue(
                                                    company,
                                                    column
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {visibleCompanies.length === 0 && (
                            <div className="companies-empty">
                                <Building2
                                    size={27}
                                    aria-hidden="true"
                                />

                                <h3>
                                    {companies.length === 0
                                        ? 'No companies available'
                                        : 'No matching companies'}
                                </h3>

                                <p>
                                    {companies.length === 0
                                        ? 'Company records will appear here once data is connected.'
                                        : 'Try another search or status filter.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    )
}