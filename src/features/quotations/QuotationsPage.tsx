import { useMemo, useState } from 'react'
import {
  Download,
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react'

export type QuotationFieldValue =
  | string
  | number
  | boolean
  | null

export type QuotationRecord = {
  id: string
  quoteNumber: string
  customerName?: string
  status?: string
  amountLabel?: string
  issuedAt?: string
  description?: string
  customFields?: Record<string, QuotationFieldValue>
}

export type QuotationColumn = {
  key: string
  label: string
}

export type QuotationsPageProps = {
  quotations?: readonly QuotationRecord[]
  columns?: readonly QuotationColumn[]
  statusOptions?: readonly string[]
  onCreate?: () => void
  onOpen?: (quotation: QuotationRecord) => void
  onExport?: () => void
}

const defaultColumns: readonly QuotationColumn[] = [
  { key: 'quoteNumber', label: 'Quotation' },
  { key: 'customerName', label: 'Customer' },
  { key: 'status', label: 'Status' },
  { key: 'amountLabel', label: 'Amount' },
  { key: 'issuedAt', label: 'Date' },
]

function displayField(
  quotation: QuotationRecord,
  key: string,
): string {
  const standard: Record<string, QuotationFieldValue> = {
    quoteNumber: quotation.quoteNumber,
    customerName: quotation.customerName ?? null,
    status: quotation.status ?? null,
    amountLabel: quotation.amountLabel ?? null,
    issuedAt: quotation.issuedAt ?? null,
    description: quotation.description ?? null,
  }

  const value = Object.prototype.hasOwnProperty.call(
    standard,
    key,
  )
    ? standard[key]
    : quotation.customFields?.[key]

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

export default function QuotationsPage({
  quotations = [],
  columns,
  statusOptions,
  onCreate,
  onOpen,
  onExport,
}: QuotationsPageProps) {
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
      ...quotations.map((quotation) => quotation.status ?? ''),
    ]
      .map((status) => status.trim())
      .filter((status) => status.length > 0)

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [quotations, statusOptions])

  const customers = useMemo(() => {
    const values = quotations
      .map((quotation) => quotation.customerName?.trim() ?? '')
      .filter((customer) => customer.length > 0)

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [quotations])

  const filteredQuotations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()

    return quotations.filter((quotation) => {
      if (
        selectedStatus !== 'all' &&
        quotation.status !== selectedStatus
      ) {
        return false
      }

      if (
        selectedCustomer !== 'all' &&
        quotation.customerName !== selectedCustomer
      ) {
        return false
      }

      const searchable = [
        quotation.quoteNumber,
        quotation.customerName ?? '',
        quotation.status ?? '',
        quotation.amountLabel ?? '',
        quotation.issuedAt ?? '',
        quotation.description ?? '',
        ...Object.values(quotation.customFields ?? {}).map(
          (value) => String(value ?? ''),
        ),
      ]
        .join(' ')
        .toLocaleLowerCase()

      return searchable.includes(query)
    })
  }, [
    quotations,
    search,
    selectedStatus,
    selectedCustomer,
  ])

  return (
    <main className="quotations-page">
      <header className="quotations-page__header">
        <div>
          <p className="quotations-page__eyebrow">
            D-GATE / SILVER CRM
          </p>

          <h1>Quotations</h1>

          <p className="quotations-page__description">
            Organize customer quotations, monitor configurable
            approval statuses, and manage commercial proposals.
          </p>
        </div>

        <button
          type="button"
          className="quotations-page__create-button"
          disabled={!onCreate}
          onClick={onCreate}
        >
          <Plus size={18} aria-hidden="true" />
          Create Quotation
        </button>
      </header>

      <section
        className="quotations-page__section"
        aria-labelledby="quotations-directory-title"
      >
        <div className="quotations-page__section-heading">
          <div>
            <h2 id="quotations-directory-title">
              Quotation Directory
            </h2>

            <p>
              View and filter quotations available to your workspace.
            </p>

            <span className="quotations-page__record-count">
              {filteredQuotations.length} of {quotations.length} records
            </span>
          </div>

          <FileText size={22} aria-hidden="true" />
        </div>

        <div className="quotations-page__toolbar">
          <label className="quotations-page__search">
            <Search size={18} aria-hidden="true" />

            <span className="quotations-page__sr-only">
              Search quotations
            </span>

            <input
              type="search"
              placeholder="Search quotations..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="quotations-page__filter">
            <SlidersHorizontal size={18} aria-hidden="true" />

            <span className="quotations-page__sr-only">
              Filter by status
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

          <label className="quotations-page__filter">
            <Users size={18} aria-hidden="true" />

            <span className="quotations-page__sr-only">
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
            className="quotations-page__export-button"
            disabled={!onExport}
            onClick={onExport}
          >
            <Download size={18} aria-hidden="true" />
            Export
          </button>
        </div>

        {filteredQuotations.length > 0 ? (
          <div className="quotations-page__table-wrap">
            <table className="quotations-page__table">
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
                {filteredQuotations.map((quotation) => (
                  <tr key={quotation.id}>
                    {visibleColumns.map((column) => (
                      <td key={column.key}>
                        {column.key === 'quoteNumber' ? (
                          <div className="quotations-page__record-main">
                            <strong>
                              {quotation.quoteNumber}
                            </strong>

                            {quotation.description && (
                              <span>
                                {quotation.description}
                              </span>
                            )}
                          </div>
                        ) : (
                          displayField(quotation, column.key)
                        )}
                      </td>
                    ))}

                    <td>
                      <button
                        type="button"
                        className="quotations-page__view-button"
                        disabled={!onOpen}
                        onClick={() => onOpen?.(quotation)}
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
          <div className="quotations-page__empty-state">
            <FileText size={38} aria-hidden="true" />

            <h3>
              {quotations.length === 0
                ? 'No quotations available'
                : 'No matching quotations'}
            </h3>

            <p>
              {quotations.length === 0
                ? 'Authorized quotation records will appear here once your workspace data is connected.'
                : 'Try changing your search term or filters.'}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}