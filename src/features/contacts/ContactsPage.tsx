import { useMemo, useState } from 'react'

import {
    ContactRound,
    Filter,
    Plus,
    Search,
} from 'lucide-react'

/**
 * D-GATE Silver CRM
 * My Contacts — Frontend Component
 *
 * Contact records, fields, display columns, and
 * optional statuses are supplied by the parent.
 *
 * No hardcoded contact records or backend calls.
 */

export type ContactFieldValue =
    | string
    | number
    | boolean
    | null

export interface ContactColumn {
    readonly id: string
    readonly label: string
    readonly key: string
}

export interface ContactStatus {
    readonly id: string
    readonly label: string
}

export interface ContactRecord {
    readonly id: string
    readonly statusId?: string | null
    readonly fields: Readonly<
        Record<string, ContactFieldValue>
    >
}

export interface ContactsPageProps {
    readonly contacts?: readonly ContactRecord[]
    readonly columns?: readonly ContactColumn[]
    readonly statuses?: readonly ContactStatus[]
    readonly onCreateContact?: () => void
    readonly onOpenContact?: (
        contact: ContactRecord
    ) => void
}

/**
 * These are initial display columns, not a fixed
 * customer contact schema.
 *
 * Customer configurations may replace these.
 */
const defaultColumns: readonly ContactColumn[] = [
    {
        id: 'contact-name',
        label: 'Contact Name',
        key: 'name',
    },
    {
        id: 'email',
        label: 'Email',
        key: 'email',
    },
    {
        id: 'phone',
        label: 'Phone',
        key: 'phone',
    },
    {
        id: 'company',
        label: 'Company',
        key: 'company',
    },
    {
        id: 'owner',
        label: 'Assigned To',
        key: 'owner',
    },
]

function formatContactValue(
    value: ContactFieldValue | undefined
): string {
    if (value === null || value === undefined) {
        return '—'
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No'
    }

    return String(value)
}

export default function ContactsPage({
    contacts = [],
    columns = defaultColumns,
    statuses = [],
    onCreateContact,
    onOpenContact,
}: ContactsPageProps) {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const visibleContacts = useMemo(() => {
        const term = search.trim().toLowerCase()

        return contacts.filter((contact) => {
            const matchesStatus =
                !statusFilter ||
                contact.statusId === statusFilter

            if (!matchesStatus) {
                return false
            }

            if (!term) {
                return true
            }

            const status = statuses.find(
                (item) => item.id === contact.statusId
            )

            const searchableValues = [
                contact.id,
                status?.label ?? '',
                ...Object.values(contact.fields),
            ]

            return searchableValues
                .some((value) =>
                    String(value ?? '')
                        .toLowerCase()
                        .includes(term)
                )
        })
    }, [contacts, search, statusFilter, statuses])

    function getCellValue(
        contact: ContactRecord,
        column: ContactColumn
    ): string {
        if (column.key === 'status') {
            return (
                statuses.find(
                    (item) => item.id === contact.statusId
                )?.label ?? '—'
            )
        }

        return formatContactValue(
            contact.fields[column.key]
        )
    }

    return (
        <div className="contacts-page">
            <header className="contacts-heading">
                <div>
                    <p className="contacts-eyebrow">
                        D-GATE / SILVER CRM
                    </p>

                    <h1>My Contacts</h1>

                    <p>
                        Manage your professional contacts,
                        relationships, and communication details.
                    </p>
                </div>

                <button
                    type="button"
                    className="contacts-create-button"
                    onClick={onCreateContact}
                    disabled={!onCreateContact}
                    title={
                        onCreateContact
                            ? 'Create contact'
                            : 'Contact creation is not connected yet'
                    }
                >
                    <Plus size={17} aria-hidden="true" />
                    New Contact
                </button>
            </header>

            <section
                className="contacts-panel"
                aria-label="Contact records"
            >
                <div className="contacts-panel-heading">
                    <div>
                        <h2>All Contacts</h2>

                        <p aria-live="polite">
                            {visibleContacts.length} of{' '}
                            {contacts.length} records
                        </p>
                    </div>

                    <ContactRound
                        size={20}
                        aria-hidden="true"
                    />
                </div>

                <div className="contacts-toolbar">
                    <label className="contacts-search">
                        <Search
                            size={17}
                            aria-hidden="true"
                        />

                        <input
                            type="search"
                            aria-label="Search contacts"
                            placeholder="Search contacts..."
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                        />
                    </label>

                    <label className="contacts-status-filter">
                        <Filter
                            size={16}
                            aria-hidden="true"
                        />

                        <select
                            aria-label="Filter contacts by status"
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
                    <div className="contacts-empty">
                        <ContactRound
                            size={28}
                            aria-hidden="true"
                        />

                        <h3>No columns configured</h3>

                        <p>
                            Contact display columns
                            have not been configured.
                        </p>
                    </div>
                ) : (
                    <div className="contacts-table-wrap">
                        <table className="contacts-table">
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
                                {visibleContacts.map((contact) => (
                                    <tr key={contact.id}>
                                        {columns.map((column, index) => {
                                            const value = getCellValue(
                                                contact,
                                                column
                                            )

                                            return (
                                                <td key={column.id}>
                                                    {index === 0 &&
                                                    onOpenContact ? (
                                                        <button
                                                            type="button"
                                                            className="contacts-record-link"
                                                            onClick={() =>
                                                                onOpenContact(
                                                                    contact
                                                                )
                                                            }
                                                            aria-label={
                                                                `Open contact ${value}`
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

                        {visibleContacts.length === 0 && (
                            <div className="contacts-empty">
                                <ContactRound
                                    size={28}
                                    aria-hidden="true"
                                />

                                <h3>
                                    {contacts.length === 0
                                        ? 'No contacts available'
                                        : 'No matching contacts'}
                                </h3>

                                <p>
                                    {contacts.length === 0
                                        ? 'Your contact records will appear here once data is connected.'
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