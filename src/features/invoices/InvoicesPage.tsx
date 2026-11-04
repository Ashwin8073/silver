import { useMemo, useState } from 'react'
import {
  Download,
  Plus,
  ReceiptText,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react'

export type InvoiceFieldValue =
  | string
  | number
  | boolean
  | null

export type InvoiceRecord = {
  id: string
  invoiceNumber: string
  customerName?: string
  status?: string
  amountLabel?: string
  outstandingLabel?: string
  issuedAt?: string
  dueAt?: string
  linkedOrder?: string
  description?: string
  customFields?: Readonly<Record<string, InvoiceFieldValue>>
}

export type InvoiceColumn = {
  key: string
  label: string
}

export type InvoicesPageProps = {
  invoices?: readonly InvoiceRecord[]
  columns?: readonly InvoiceColumn[]
  statusOptions?: readonly string[]
  onCreate?: () => void
  onOpen?: (invoice: InvoiceRecord) => void
  onExport?: () => void
}

const defaultColumns: readonly InvoiceColumn[] = [
  { key: 'invoiceNumber', label: 'Invoice' },
  { key: 'customerName', label: 'Customer' },
  { key: 'status', label: 'Status' },
  { key: 'amountLabel', label: 'Total Amount' },
  { key: 'outstandingLabel', label: 'Outstanding' },
  { key: 'issuedAt', label: 'Issue Date' },
  { key: 'dueAt', label: 'Due Date' },
]

function displayField(
  invoice: InvoiceRecord,
  key: string,
): string {
  const standard: Record<string, InvoiceFieldValue> = {
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName ?? null,
    status: invoice.status ?? null,
    amountLabel: invoice.amountLabel ?? null,
    outstandingLabel: invoice.outstandingLabel ?? null,
    issuedAt: invoice.issuedAt ?? null,
    dueAt: invoice.dueAt ?? null,
    linkedOrder: invoice.linkedOrder ?? null,
    description: invoice.description ?? null,
  }

  const value = Object.prototype.hasOwnProperty.call(
    standard,
    key,
  )
    ? standard[key]
    : invoice.customFields?.[key]

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—'
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return String(value)
}

export default function InvoicesPage({
  invoices = [],
  columns,
  statusOptions,
  onCreate,
  onOpen,
  onExport,
}: InvoicesPageProps) {
  const [search, setSearch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedCustomer, setSelectedCustomer] = useState('all')

  const visibleColumns =
    columns && columns.length > 0
      ? columns
      : defaultColumns

  const statuses = useMemo(() => {
    const values = [
      ...(statusOptions ?? []),
      ...invoices.map((invoice) => invoice.status ?? ''),
    ]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [invoices, statusOptions])

  const customers = useMemo(() => {
    const values = invoices
      .map((invoice) => invoice.customerName?.trim() ?? '')
      .filter((value) => value.length > 0)

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [invoices])

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()

    return invoices.filter((invoice) => {
      if (
        selectedStatus !== 'all' &&
        invoice.status !== selectedStatus
      ) {
        return false
      }

      if (
        selectedCustomer !== 'all' &&
        invoice.customerName !== selectedCustomer
      ) {
        return false
      }

      const searchable = [
        invoice.invoiceNumber,
        invoice.customerName ?? '',
        invoice.status ?? '',
        invoice.amountLabel ?? '',
        invoice.outstandingLabel ?? '',
        invoice.issuedAt ?? '',
        invoice.dueAt ?? '',
        invoice.linkedOrder ?? '',
        invoice.description ?? '',
        ...Object.values(invoice.customFields ?? {}).map(
          (value) => String(value ?? ''),
        ),
      ]
        .join(' ')
        .toLocaleLowerCase()

      return searchable.includes(query)
    })
  }, [
    invoices,
    search,
    selectedStatus,
    selectedCustomer,
  ])

  return (
    <main className="invoices-page">
      <header className="invoices-page__header">
        <div>
          <p className="invoices-page__eyebrow">
            D-GATE / SILVER CRM
          </p>

          <h1>Invoices</h1>

          <p className="invoices-page__description">
            Manage customer invoices, track payment statuses,
            and review outstanding amounts and due dates.
          </p>
        </div>

        <button
          type="button"
          className="invoices-page__create-button"
          disabled={!onCreate}
          onClick={onCreate}
        >
          <Plus size={18} aria-hidden="true" />
          Create Invoice
        </button>
      </header>

      <section
        className="invoices-page__section"
        aria-labelledby="invoices-directory-title"
      >
        <div className="invoices-page__section-heading">
          <div>
            <h2 id="invoices-directory-title">
              Invoice Directory
            </h2>

            <p>
              Browse and filter invoices in your workspace.
            </p>

            <span className="invoices-page__record-count">
              {filteredInvoices.length} of {invoices.length} records
            </span>
          </div>

          <ReceiptText size={22} aria-hidden="true" />
        </div>

        <div className="invoices-page__toolbar">
          <label className="invoices-page__search">
            <Search size={18} aria-hidden="true" />

            <span className="invoices-page__sr-only">
              Search invoices
            </span>

            <input
              type="search"
              placeholder="Search invoices..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="invoices-page__filter">
            <SlidersHorizontal size={18} aria-hidden="true" />

            <span className="invoices-page__sr-only">
              Filter by invoice status
            </span>

            <select
              value={selectedStatus}
              onChange={(event) =>
                setSelectedStatus(event.target.value)
              }
            >
              <option value="all">All statuses</option>

              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="invoices-page__filter">
            <Users size={18} aria-hidden="true" />

            <span className="invoices-page__sr-only">
              Filter by customer
            </span>

            <select
              value={selectedCustomer}
              onChange={(event) =>
                setSelectedCustomer(event.target.value)
              }
            >
              <option value="all">All customers</option>

              {customers.map((customer) => (
                <option key={customer} value={customer}>
                  {customer}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="invoices-page__export-button"
            disabled={!onExport}
            onClick={onExport}
          >
            <Download size={18} aria-hidden="true" />
            Export
          </button>
        </div>

        {filteredInvoices.length > 0 ? (
          <div className="invoices-page__table-wrap">
            <table className="invoices-page__table">
              <thead>
                <tr>
                  {visibleColumns.map((column) => (
                    <th key={column.key} scope="col">
                      {column.label}
                    </th>
                  ))}
                  <th scope="col">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    {visibleColumns.map((column) => (
                      <td key={column.key}>
                        {column.key === 'invoiceNumber' ? (
                          <div className="invoices-page__record-main">
                            <strong>
                              {invoice.invoiceNumber}
                            </strong>

                            {invoice.description && (
                              <span>
                                {invoice.description}
                              </span>
                            )}
                          </div>
                        ) : (
                          displayField(invoice, column.key)
                        )}
                      </td>
                    ))}

                    <td>
                      <button
                        type="button"
                        className="invoices-page__view-button"
                        disabled={!onOpen}
                        onClick={() => onOpen?.(invoice)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="invoices-page__empty-state">
            <ReceiptText size={38} aria-hidden="true" />

            <h3>
              {invoices.length === 0
                ? 'No invoices available'
                : 'No matching invoices'}
            </h3>

            <p>
              {invoices.length === 0
                ? 'Authorized invoice records will appear here once your workspace data is connected.'
                : 'Try changing your search term or filters.'}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}