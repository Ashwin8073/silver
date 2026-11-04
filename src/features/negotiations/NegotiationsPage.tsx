import { useMemo, useState } from 'react'
import {
  MessageSquare,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react'

export type NegotiationFieldValue =
  | string
  | number
  | boolean
  | null

export type NegotiationRecord = {
  id: string
  title: string
  customerName?: string
  quotationReference?: string
  stage?: string
  amountLabel?: string
  ownerName?: string
  updatedAt?: string
  summary?: string
  customFields?: Readonly<Record<string, NegotiationFieldValue>>
}

export type NegotiationColumn = {
  key: string
  label: string
}

export type NegotiationsPageProps = {
  negotiations?: readonly NegotiationRecord[]
  columns?: readonly NegotiationColumn[]
  stageOptions?: readonly string[]
  onCreate?: () => void
  onOpen?: (negotiation: NegotiationRecord) => void
}

const defaultColumns: readonly NegotiationColumn[] = [
  { key: 'title', label: 'Negotiation' },
  { key: 'customerName', label: 'Customer' },
  { key: 'quotationReference', label: 'Quotation' },
  { key: 'stage', label: 'Stage' },
  { key: 'amountLabel', label: 'Amount' },
  { key: 'ownerName', label: 'Owner' },
  { key: 'updatedAt', label: 'Last Updated' },
]

function displayField(
  negotiation: NegotiationRecord,
  key: string,
): string {
  const standard: Record<string, NegotiationFieldValue> = {
    title: negotiation.title,
    customerName: negotiation.customerName ?? null,
    quotationReference: negotiation.quotationReference ?? null,
    stage: negotiation.stage ?? null,
    amountLabel: negotiation.amountLabel ?? null,
    ownerName: negotiation.ownerName ?? null,
    updatedAt: negotiation.updatedAt ?? null,
    summary: negotiation.summary ?? null,
  }

  const value = Object.prototype.hasOwnProperty.call(
    standard,
    key,
  )
    ? standard[key]
    : negotiation.customFields?.[key]

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

export default function NegotiationsPage({
  negotiations = [],
  columns,
  stageOptions,
  onCreate,
  onOpen,
}: NegotiationsPageProps) {
  const [search, setSearch] = useState('')
  const [selectedStage, setSelectedStage] = useState('all')
  const [selectedCustomer, setSelectedCustomer] = useState('all')

  const visibleColumns =
    columns && columns.length > 0
      ? columns
      : defaultColumns

  const stages = useMemo(() => {
    const values = [
      ...(stageOptions ?? []),
      ...negotiations.map((item) => item.stage ?? ''),
    ]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [negotiations, stageOptions])

  const customers = useMemo(() => {
    const values = negotiations
      .map((item) => item.customerName?.trim() ?? '')
      .filter((value) => value.length > 0)

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [negotiations])

  const filteredNegotiations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()

    return negotiations.filter((item) => {
      if (
        selectedStage !== 'all' &&
        item.stage !== selectedStage
      ) {
        return false
      }

      if (
        selectedCustomer !== 'all' &&
        item.customerName !== selectedCustomer
      ) {
        return false
      }

      const searchable = [
        item.title,
        item.customerName ?? '',
        item.quotationReference ?? '',
        item.stage ?? '',
        item.amountLabel ?? '',
        item.ownerName ?? '',
        item.summary ?? '',
        ...Object.values(item.customFields ?? {}).map(
          (value) => String(value ?? ''),
        ),
      ]
        .join(' ')
        .toLocaleLowerCase()

      return searchable.includes(query)
    })
  }, [
    negotiations,
    search,
    selectedStage,
    selectedCustomer,
  ])

  return (
    <main className="negotiations-page">
      <header className="negotiations-page__header">
        <div>
          <p className="negotiations-page__eyebrow">
            D-GATE / SILVER CRM
          </p>

          <h1>Negotiations</h1>

          <p className="negotiations-page__description">
            Track customer discussions, linked quotations,
            and customizable negotiation stages.
          </p>
        </div>

        <button
          type="button"
          className="negotiations-page__create-button"
          disabled={!onCreate}
          onClick={onCreate}
        >
          <Plus size={18} aria-hidden="true" />
          Add Negotiation
        </button>
      </header>

      <section
        className="negotiations-page__section"
        aria-labelledby="negotiations-directory-title"
      >
        <div className="negotiations-page__section-heading">
          <div>
            <h2 id="negotiations-directory-title">
              Negotiation Directory
            </h2>

            <p>
              Review and filter negotiations in your workspace.
            </p>

            <span className="negotiations-page__record-count">
              {filteredNegotiations.length} of {negotiations.length} records
            </span>
          </div>

          <MessageSquare size={22} aria-hidden="true" />
        </div>

        <div className="negotiations-page__toolbar">
          <label className="negotiations-page__search">
            <Search size={18} aria-hidden="true" />

            <span className="negotiations-page__sr-only">
              Search negotiations
            </span>

            <input
              type="search"
              placeholder="Search negotiations..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="negotiations-page__filter">
            <SlidersHorizontal size={18} aria-hidden="true" />

            <span className="negotiations-page__sr-only">
              Filter by negotiation stage
            </span>

            <select
              value={selectedStage}
              onChange={(event) =>
                setSelectedStage(event.target.value)
              }
            >
              <option value="all">All stages</option>

              {stages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>

          <label className="negotiations-page__filter">
            <Users size={18} aria-hidden="true" />

            <span className="negotiations-page__sr-only">
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
        </div>

        {filteredNegotiations.length > 0 ? (
          <div className="negotiations-page__table-wrap">
            <table className="negotiations-page__table">
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
                {filteredNegotiations.map((item) => (
                  <tr key={item.id}>
                    {visibleColumns.map((column) => (
                      <td key={column.key}>
                        {column.key === 'title' ? (
                          <div className="negotiations-page__record-main">
                            <strong>{item.title}</strong>

                            {item.summary && (
                              <span>{item.summary}</span>
                            )}
                          </div>
                        ) : (
                          displayField(item, column.key)
                        )}
                      </td>
                    ))}

                    <td>
                      <button
                        type="button"
                        className="negotiations-page__view-button"
                        disabled={!onOpen}
                        onClick={() => onOpen?.(item)}
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
          <div className="negotiations-page__empty-state">
            <MessageSquare size={38} aria-hidden="true" />

            <h3>
              {negotiations.length === 0
                ? 'No negotiations available'
                : 'No matching negotiations'}
            </h3>

            <p>
              {negotiations.length === 0
                ? 'Authorized negotiation records will appear here once your workspace data is connected.'
                : 'Try a different search term or filter.'}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}