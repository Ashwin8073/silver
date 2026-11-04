import { useMemo, useState } from 'react'
import {
  CreditCard,
  Download,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  Wallet,
} from 'lucide-react'

export type PaymentFieldValue =
  | string
  | number
  | boolean
  | null

export type PaymentRecord = {
  id: string
  paymentReference: string
  customerName?: string
  invoiceReference?: string
  method?: string
  status?: string
  amountLabel?: string
  recordedAt?: string
  description?: string
  customFields?: Readonly<Record<string, PaymentFieldValue>>
}

export type PaymentColumn = {
  key: string
  label: string
}

export type PaymentsPageProps = {
  payments?: readonly PaymentRecord[]
  columns?: readonly PaymentColumn[]
  statusOptions?: readonly string[]
  methodOptions?: readonly string[]
  onCreate?: () => void
  onOpen?: (payment: PaymentRecord) => void
  onExport?: () => void
}

const defaultColumns: readonly PaymentColumn[] = [
  { key: 'paymentReference', label: 'Payment Reference' },
  { key: 'customerName', label: 'Customer' },
  { key: 'invoiceReference', label: 'Invoice' },
  { key: 'method', label: 'Payment Method' },
  { key: 'status', label: 'Status' },
  { key: 'amountLabel', label: 'Amount' },
  { key: 'recordedAt', label: 'Payment Date' },
]

function displayField(
  payment: PaymentRecord,
  key: string,
): string {
  const standard: Record<string, PaymentFieldValue> = {
    paymentReference: payment.paymentReference,
    customerName: payment.customerName ?? null,
    invoiceReference: payment.invoiceReference ?? null,
    method: payment.method ?? null,
    status: payment.status ?? null,
    amountLabel: payment.amountLabel ?? null,
    recordedAt: payment.recordedAt ?? null,
    description: payment.description ?? null,
  }

  const value = Object.prototype.hasOwnProperty.call(
    standard,
    key,
  )
    ? standard[key]
    : payment.customFields?.[key]

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

export default function PaymentsPage({
  payments = [],
  columns,
  statusOptions,
  methodOptions,
  onCreate,
  onOpen,
  onExport,
}: PaymentsPageProps) {
  const [search, setSearch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedMethod, setSelectedMethod] = useState('all')
  const [selectedCustomer, setSelectedCustomer] = useState('all')

  const visibleColumns =
    columns && columns.length > 0
      ? columns
      : defaultColumns

  const statuses = useMemo(() => {
    const values = [
      ...(statusOptions ?? []),
      ...payments.map((payment) => payment.status ?? ''),
    ]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [payments, statusOptions])

  const methods = useMemo(() => {
    const values = [
      ...(methodOptions ?? []),
      ...payments.map((payment) => payment.method ?? ''),
    ]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [payments, methodOptions])

  const customers = useMemo(() => {
    const values = payments
      .map((payment) => payment.customerName?.trim() ?? '')
      .filter((value) => value.length > 0)

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [payments])

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()

    return payments.filter((payment) => {
      if (
        selectedStatus !== 'all' &&
        payment.status?.trim() !== selectedStatus
      ) {
        return false
      }

      if (
        selectedMethod !== 'all' &&
        payment.method?.trim() !== selectedMethod
      ) {
        return false
      }

      if (
        selectedCustomer !== 'all' &&
        payment.customerName?.trim() !== selectedCustomer
      ) {
        return false
      }

      const searchable = [
        payment.paymentReference,
        payment.customerName ?? '',
        payment.invoiceReference ?? '',
        payment.method ?? '',
        payment.status ?? '',
        payment.amountLabel ?? '',
        payment.recordedAt ?? '',
        payment.description ?? '',
        ...Object.values(payment.customFields ?? {}).map(
          (value) => String(value ?? ''),
        ),
      ]
        .join(' ')
        .toLocaleLowerCase()

      return searchable.includes(query)
    })
  }, [
    payments,
    search,
    selectedStatus,
    selectedMethod,
    selectedCustomer,
  ])

  return (
    <main className="payments-page">
      <header className="payments-page__header">
        <div>
          <p className="payments-page__eyebrow">
            D-GATE / SILVER CRM
          </p>

          <h1>Payments</h1>

          <p className="payments-page__description">
            Track customer payments, linked invoices,
            payment methods, and configurable payment statuses.
          </p>
        </div>

        <button
          type="button"
          className="payments-page__create-button"
          disabled={!onCreate}
          onClick={onCreate}
        >
          <Plus size={18} aria-hidden="true" />
          Record Payment
        </button>
      </header>

      <section
        className="payments-page__section"
        aria-labelledby="payments-directory-title"
      >
        <div className="payments-page__section-heading">
          <div>
            <h2 id="payments-directory-title">
              Payment Directory
            </h2>

            <p>
              Browse and filter authorized payment records
              for your workspace.
            </p>

            <span className="payments-page__record-count">
              {filteredPayments.length} of {payments.length} records
            </span>
          </div>

          <Wallet size={22} aria-hidden="true" />
        </div>

        <div className="payments-page__toolbar">
          <label className="payments-page__search">
            <Search size={18} aria-hidden="true" />

            <span className="payments-page__sr-only">
              Search payments
            </span>

            <input
              type="search"
              placeholder="Search payments..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="payments-page__filter">
            <SlidersHorizontal size={18} aria-hidden="true" />

            <span className="payments-page__sr-only">
              Filter by payment status
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

          <label className="payments-page__filter">
            <CreditCard size={18} aria-hidden="true" />

            <span className="payments-page__sr-only">
              Filter by payment method
            </span>

            <select
              value={selectedMethod}
              onChange={(event) =>
                setSelectedMethod(event.target.value)
              }
            >
              <option value="all">All methods</option>

              {methods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>

          <label className="payments-page__filter">
            <Users size={18} aria-hidden="true" />

            <span className="payments-page__sr-only">
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
            className="payments-page__export-button"
            disabled={!onExport}
            onClick={onExport}
          >
            <Download size={18} aria-hidden="true" />
            Export
          </button>
        </div>

        {filteredPayments.length > 0 ? (
          <div className="payments-page__table-wrap">
            <table className="payments-page__table">
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
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    {visibleColumns.map((column) => (
                      <td key={column.key}>
                        {column.key === 'paymentReference' ? (
                          <div className="payments-page__record-main">
                            <strong>
                              {payment.paymentReference}
                            </strong>

                            {payment.description && (
                              <span>
                                {payment.description}
                              </span>
                            )}
                          </div>
                        ) : (
                          displayField(payment, column.key)
                        )}
                      </td>
                    ))}

                    <td>
                      <button
                        type="button"
                        className="payments-page__view-button"
                        disabled={!onOpen}
                        onClick={() => onOpen?.(payment)}
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
          <div className="payments-page__empty-state">
            <Wallet size={38} aria-hidden="true" />

            <h3>
              {payments.length === 0
                ? 'No payments available'
                : 'No matching payments'}
            </h3>

            <p>
              {payments.length === 0
                ? 'Authorized payment records will appear here once your workspace data is connected.'
                : 'Try changing your search term or filters.'}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}