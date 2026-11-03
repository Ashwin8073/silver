import { useMemo, useRef, useState } from 'react'
import {
    Filter,
    Plus,
    Search,
    Users,
} from 'lucide-react'

import LeadForm, { type LeadFieldDefinition } from './LeadForm'
import './LeadForm.css'

/*
 * Development-only example schema.
 * Real fields must come from company configuration.
 */
const developmentFormFields: readonly LeadFieldDefinition[] = [
    {
        id: 'contact_name',
        label: 'Contact Name',
        type: 'text',
        required: true,
        placeholder: 'Enter contact name',
    },
    {
        id: 'email',
        label: 'Email Address',
        type: 'email',
        required: true,
        placeholder: 'Enter email address',
    },
    {
        id: 'phone',
        label: 'Phone Number',
        type: 'phone',
        placeholder: 'Enter phone number',
    },
    {
        id: 'company',
        label: 'Company',
        type: 'text',
        placeholder: 'Enter company name',
    },
    {
        id: 'preferred_channel',
        label: 'Preferred Contact Channel',
        type: 'select',
        required: true,
        options: [
            { value: 'email', label: 'Email' },
            { value: 'phone', label: 'Phone' },
            { value: 'whatsapp', label: 'WhatsApp' },
        ],
    },
    {
        id: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Enter additional information',
    },
    {
        id: 'priority',
        label: 'Priority Lead',
        type: 'checkbox',
    },
]
export interface LeadColumn {
    id: string
    label: string
    key: string
}

export interface LeadStatus {
    id: string
    label: string
}

export interface LeadRow {
    id: string
    statusId?: string | null
    fields: Readonly<Record<string, string | number | null>>
}

export interface LeadsPageProps {
    rows?: readonly LeadRow[]
    columns?: readonly LeadColumn[]
    statuses?: readonly LeadStatus[]
    onCreateLead?: () => void
}

/*
 * Default display columns only.
 * Companies may configure their own columns and fields.
 */
const defaultColumns: readonly LeadColumn[] = [
    {
        id: 'lead-name',
        label: 'Lead Name',
        key: 'name',
    },
    {
        id: 'company',
        label: 'Company',
        key: 'company',
    },
    {
        id: 'status',
        label: 'Status',
        key: 'status',
    },
    {
        id: 'owner',
        label: 'Assigned To',
        key: 'owner',
    },
]

export default function LeadsPage({
    rows = [],
    columns = defaultColumns,
    statuses = [],
    onCreateLead,
}: LeadsPageProps) {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const previewDialogRef = useRef<HTMLDialogElement>(null)
    const [previewFeedback, setPreviewFeedback] = useState('')

    const visibleRows = useMemo(() => {
        const term = search.trim().toLowerCase()

        return rows.filter((lead) => {
            const matchesStatus =
                !statusFilter ||
                lead.statusId === statusFilter

            const statusName =
                statuses.find(
                    (status) => status.id === lead.statusId
                )?.label ?? ''

            const searchable = [
                lead.id,
                statusName,
                ...Object.values(lead.fields),
            ]
                .map((value) => String(value ?? ''))
                .join(' ')
                .toLowerCase()

            return matchesStatus &&
                (!term || searchable.includes(term))
        })
    }, [rows, search, statusFilter, statuses])

    function openPreview() {
        setPreviewFeedback('')
        previewDialogRef.current?.showModal()
    }

    function closePreview() {
        previewDialogRef.current?.close()
    }

    function handlePreviewSubmit() {
        setPreviewFeedback(
            'Validation passed. Preview only: no lead was saved.'
        )
    }
    function getCellValue(
        lead: LeadRow,
        column: LeadColumn
    ): string | number {
        if (column.key === 'status' && lead.statusId) {
            const matchingStatus = statuses.find(
                (status) => status.id === lead.statusId
            )

            if (matchingStatus) {
                return matchingStatus.label
            }
        }

        return lead.fields[column.key] ?? '—'
    }

    return (
        <div className="leads-page">
            <header className="leads-heading">
                <div>
                    <p className="leads-eyebrow">
                        D-GATE / SILVER CRM
                    </p>

                    <h1>Leads</h1>

                    <p>
                        Manage prospects, assignments,
                        and sales opportunities.
                    </p>
                </div>

                <button
                    type="button"
                    className="leads-create-button"
                    onClick={onCreateLead ?? (import.meta.env.DEV ? openPreview : undefined)}
                    disabled={!onCreateLead && !import.meta.env.DEV}
                    title={
                        onCreateLead
                            ? 'Create lead'
                            : import.meta.env.DEV ? 'Preview only: no data will be saved' : 'Lead creation is not connected yet'
                    }
                >
                    <Plus size={17} aria-hidden="true" />
                    {import.meta.env.DEV && !onCreateLead ? 'Preview Lead Form' : 'New Lead'}
                </button>
            </header>

            <section
                className="leads-panel"
                aria-label="Lead records"
            >
                <div className="leads-panel-heading">
                    <div>
                        <h2>All Leads</h2>
                        <p aria-live="polite">
                            {visibleRows.length} of {rows.length}
                            {' '}records
                        </p>
                    </div>

                    <Users
                        size={20}
                        aria-hidden="true"
                    />
                </div>

                <div className="leads-toolbar">
                    <label className="leads-search">
                        <Search
                            size={17}
                            aria-hidden="true"
                        />

                        <input
                            type="search"
                            placeholder="Search leads..."
                            aria-label="Search leads"
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                        />
                    </label>

                    <label className="leads-status-filter">
                        <Filter
                            size={16}
                            aria-hidden="true"
                        />

                        <select
                            aria-label="Filter leads by status"
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(event.target.value)
                            }
                            disabled={statuses.length === 0}
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
                    <div className="leads-empty">
                        <p>
                            No lead columns are configured.
                        </p>
                    </div>
                ) : (
                    <div className="leads-table-wrap">
                        <table className="leads-table">
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
                                {visibleRows.map((lead) => (
                                    <tr key={lead.id}>
                                        {columns.map((column) => (
                                            <td key={column.id}>
                                                {getCellValue(
                                                    lead,
                                                    column
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {visibleRows.length === 0 && (
                            <div className="leads-empty">
                                <Users
                                    size={26}
                                    aria-hidden="true"
                                />

                                <h3>
                                    {rows.length === 0
                                        ? 'No leads available'
                                        : 'No matching leads'}
                                </h3>

                                <p>
                                    {rows.length === 0
                                        ? 'Lead records will appear here once data is connected.'
                                        : 'Try another search or status filter.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </section>
            {import.meta.env.DEV && (
                <dialog
                    ref={previewDialogRef}
                    aria-label="Lead form preview"
                    onClose={() => setPreviewFeedback('')}
                    style={{
                        width: 'min(760px, calc(100% - 28px))',
                        maxHeight: '90dvh',
                        margin: 'auto',
                        padding: 0,
                        border: '1px solid var(--color-border)',
                        borderRadius: 16,
                        boxShadow: '0 24px 70px rgba(24, 18, 48, 0.22)',
                    }}
                >
                    <div
                        style={{
                            padding: '12px 24px',
                            background: 'var(--color-violet-light)',
                            color: 'var(--color-violet-dark)',
                            fontSize: 12,
                            fontWeight: 700,
                        }}
                    >
                        Development preview only. No records will be saved.
                    </div>

                    <LeadForm
                        fields={developmentFormFields}
                        title="New Lead — Preview"
                        onCancel={closePreview}
                        onSubmit={handlePreviewSubmit}
                    />

                    {previewFeedback && (
                        <p
                            role="status"
                            style={{
                                margin: 0,
                                padding: '12px 24px',
                                color: 'var(--color-success)',
                                fontSize: 12,
                            }}
                        >
                            {previewFeedback}
                        </p>
                    )}
                </dialog>
            )}
        </div>
    )
}