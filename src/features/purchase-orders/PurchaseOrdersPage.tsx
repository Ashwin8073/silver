import { useMemo, useState } from 'react'
import {
  ClipboardList,
  Download,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react'

export type PurchaseOrderFieldValue =
  | string
  | number
  | boolean
  | null

export type PurchaseOrderRecord = {
  id: string
  orderNumber: string
  partyName?: string
  partyKind?: string
  status?: string
  amountLabel?: string
  orderDate?: string
  expectedDate?: string
  linkedQuotation?: string
  description?: string
  customFields?: Readonly<
    Record<string, PurchaseOrderFieldValue>
  >
}

export type PurchaseOrderColumn = {
  key: string
  label: string
}

export type PurchaseOrdersPageProps = {
  orders?: readonly PurchaseOrderRecord[]
  columns?: readonly PurchaseOrderColumn[]
  statusOptions?: readonly string[]
  onCreate?: () => void
  onOpen?: (order: PurchaseOrderRecord) => void
  onExport?: () => void
}

const defaultColumns: readonly PurchaseOrderColumn[] = [
  { key: 'orderNumber', label: 'Purchase Order' },
  { key: 'partyName', label: 'Customer / Supplier' },
  { key: 'status', label: 'Status' },
  { key: 'amountLabel', label: 'Amount' },
  { key: 'orderDate', label: 'Order Date' },
  { key: 'expectedDate', label: 'Expected Date' },
]

function displayField(
  order: PurchaseOrderRecord,
  key: string,
): string {
  const standard: Record<string, PurchaseOrderFieldValue> = {
    orderNumber: order.orderNumber,
    partyName: order.partyName ?? null,
    partyKind: order.partyKind ?? null,
    status: order.status ?? null,
    amountLabel: order.amountLabel ?? null,
    orderDate: order.orderDate ?? null,
    expectedDate: order.expectedDate ?? null,
    linkedQuotation: order.linkedQuotation ?? null,
    description: order.description ?? null,
  }

  const value = Object.prototype.hasOwnProperty.call(
    standard,
    key,
  )
    ? standard[key]
    : order.customFields?.[key]

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

export default function PurchaseOrdersPage({
  orders = [],
  columns,
  statusOptions,
  onCreate,
  onOpen,
  onExport,
}: PurchaseOrdersPageProps) {
  const [search, setSearch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedParty, setSelectedParty] = useState('all')

  const visibleColumns =
    columns && columns.length > 0
      ? columns
      : defaultColumns

  const statuses = useMemo(() => {
    const values = [
      ...(statusOptions ?? []),
      ...orders.map((order) => order.status ?? ''),
    ]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [orders, statusOptions])

  const parties = useMemo(() => {
    const values = orders
      .map((order) => order.partyName?.trim() ?? '')
      .filter((value) => value.length > 0)

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [orders])

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()

    return orders.filter((order) => {
      if (
        selectedStatus !== 'all' &&
        order.status !== selectedStatus
      ) {
        return false
      }

      if (
        selectedParty !== 'all' &&
        order.partyName !== selectedParty
      ) {
        return false
      }

      const searchable = [
        order.orderNumber,
        order.partyName ?? '',
        order.partyKind ?? '',
        order.status ?? '',
        order.amountLabel ?? '',
        order.orderDate ?? '',
        order.expectedDate ?? '',
        order.linkedQuotation ?? '',
        order.description ?? '',
        ...Object.values(order.customFields ?? {}).map(
          (value) => String(value ?? ''),
        ),
      ]
        .join(' ')
        .toLocaleLowerCase()

      return searchable.includes(query)
    })
  }, [
    orders,
    search,
    selectedStatus,
    selectedParty,
  ])

  return (
    <main className="purchase-orders-page">
      <header className="purchase-orders-page__header">
        <div>
          <p className="purchase-orders-page__eyebrow">
            D-GATE / SILVER CRM
          </p>

          <h1>Purchase Orders</h1>

          <p className="purchase-orders-page__description">
            Organize purchase orders, track business partners,
            and monitor configurable order statuses.
          </p>
        </div>

        <button
          type="button"
          className="purchase-orders-page__create-button"
          disabled={!onCreate}
          onClick={onCreate}
        >
          <Plus size={18} aria-hidden="true" />
          Create Purchase Order
        </button>
      </header>

      <section
        className="purchase-orders-page__section"
        aria-labelledby="purchase-orders-directory-title"
      >
        <div className="purchase-orders-page__section-heading">
          <div>
            <h2 id="purchase-orders-directory-title">
              Purchase Order Directory
            </h2>

            <p>
              View and filter purchase orders in your workspace.
            </p>

            <span className="purchase-orders-page__record-count">
              {filteredOrders.length} of {orders.length} records
            </span>
          </div>

          <ClipboardList size={22} aria-hidden="true" />
        </div>

        <div className="purchase-orders-page__toolbar">
          <label className="purchase-orders-page__search">
            <Search size={18} aria-hidden="true" />

            <span className="purchase-orders-page__sr-only">
              Search purchase orders
            </span>

            <input
              type="search"
              placeholder="Search purchase orders..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="purchase-orders-page__filter">
            <SlidersHorizontal size={18} aria-hidden="true" />

            <span className="purchase-orders-page__sr-only">
              Filter by order status
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

          <label className="purchase-orders-page__filter">
            <Users size={18} aria-hidden="true" />

            <span className="purchase-orders-page__sr-only">
              Filter by customer or supplier
            </span>

            <select
              value={selectedParty}
              onChange={(event) =>
                setSelectedParty(event.target.value)
              }
            >
              <option value="all">
                All customers / suppliers
              </option>

              {parties.map((party) => (
                <option key={party} value={party}>
                  {party}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="purchase-orders-page__export-button"
            disabled={!onExport}
            onClick={onExport}
          >
            <Download size={18} aria-hidden="true" />
            Export
          </button>
        </div>

        {filteredOrders.length > 0 ? (
          <div className="purchase-orders-page__table-wrap">
            <table className="purchase-orders-page__table">
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
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    {visibleColumns.map((column) => (
                      <td key={column.key}>
                        {column.key === 'orderNumber' ? (
                          <div className="purchase-orders-page__record-main">
                            <strong>
                              {order.orderNumber}
                            </strong>

                            {order.description && (
                              <span>
                                {order.description}
                              </span>
                            )}
                          </div>
                        ) : (
                          displayField(order, column.key)
                        )}
                      </td>
                    ))}

                    <td>
                      <button
                        type="button"
                        className="purchase-orders-page__view-button"
                        disabled={!onOpen}
                        onClick={() => onOpen?.(order)}
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
          <div className="purchase-orders-page__empty-state">
            <ClipboardList size={38} aria-hidden="true" />

            <h3>
              {orders.length === 0
                ? 'No purchase orders available'
                : 'No matching purchase orders'}
            </h3>

            <p>
              {orders.length === 0
                ? 'Authorized purchase order records will appear here once your workspace data is connected.'
                : 'Try a different search term or filter.'}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}