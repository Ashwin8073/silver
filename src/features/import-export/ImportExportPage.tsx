import { useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  Download,
  FileDown,
  FileUp,
  Search,
  SlidersHorizontal,
} from 'lucide-react'

export type TransferDirection = 'import' | 'export'

export type TransferFieldValue =
  | string
  | number
  | boolean
  | null

export type DataTransferRecord = {
  id: string
  name: string
  direction: TransferDirection
  status?: string
  entityLabel?: string
  recordCount?: number
  initiatedBy?: string
  createdAt?: string
  description?: string
  customFields?: Readonly<Record<string, TransferFieldValue>>
}

export type TransferColumn = {
  key: string
  label: string
}

export type ImportExportPageProps = {
  records?: readonly DataTransferRecord[]
  columns?: readonly TransferColumn[]
  statusOptions?: readonly string[]
  onStartImport?: () => void
  onStartExport?: () => void
  onOpenRecord?: (record: DataTransferRecord) => void
}

const defaultColumns: readonly TransferColumn[] = [
  { key: 'name', label: 'Operation' },
  { key: 'direction', label: 'Type' },
  { key: 'entityLabel', label: 'CRM Module' },
  { key: 'status', label: 'Status' },
  { key: 'recordCount', label: 'Records' },
  { key: 'initiatedBy', label: 'Initiated By' },
  { key: 'createdAt', label: 'Date' },
]

function displayField(
  record: DataTransferRecord,
  key: string,
): string {
  const standard: Record<string, TransferFieldValue> = {
    name: record.name,
    direction:
      record.direction === 'import' ? 'Import' : 'Export',
    entityLabel: record.entityLabel ?? null,
    status: record.status ?? null,
    recordCount: record.recordCount ?? null,
    initiatedBy: record.initiatedBy ?? null,
    createdAt: record.createdAt ?? null,
    description: record.description ?? null,
  }

  const value = Object.prototype.hasOwnProperty.call(
    standard,
    key,
  )
    ? standard[key]
    : record.customFields?.[key]

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

export default function ImportExportPage({
  records = [],
  columns,
  statusOptions,
  onStartImport,
  onStartExport,
  onOpenRecord,
}: ImportExportPageProps) {
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState('all')
  const [status, setStatus] = useState('all')

  const visibleColumns =
    columns && columns.length > 0
      ? columns
      : defaultColumns

  const statuses = useMemo(() => {
    const values = [
      ...(statusOptions ?? []),
      ...records.map((record) => record.status ?? ''),
    ]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [records, statusOptions])

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()

    return records.filter((record) => {
      if (
        direction !== 'all' &&
        record.direction !== direction
      ) {
        return false
      }

      if (
        status !== 'all' &&
        record.status?.trim() !== status
      ) {
        return false
      }

      const searchable = [
        record.name,
        record.direction,
        record.entityLabel ?? '',
        record.status ?? '',
        record.initiatedBy ?? '',
        record.description ?? '',
        ...Object.values(record.customFields ?? {}).map(
          (value) => String(value ?? ''),
        ),
      ]
        .join(' ')
        .toLocaleLowerCase()

      return searchable.includes(query)
    })
  }, [records, search, direction, status])

  return (
    <main className="import-export-page">
      <header className="import-export-page__header">
        <div>
          <p className="import-export-page__eyebrow">
            D-GATE / SILVER CRM
          </p>

          <h1>Import / Export</h1>

          <p className="import-export-page__description">
            Manage authorized CRM data transfers, review
            operation history, and prepare structured imports
            and exports for your workspace.
          </p>
        </div>
      </header>

      <section
        className="import-export-page__actions"
        aria-label="Data transfer actions"
      >
        <article className="import-export-page__action-card">
          <div className="import-export-page__action-icon">
            <FileUp size={24} aria-hidden="true" />
          </div>

          <div>
            <h2>Import Data</h2>

            <p>
              Prepare authorized CRM imports with field
              mapping, validation, and review before applying data.
            </p>
          </div>

          <button
            type="button"
            className="import-export-page__import-button"
            disabled={!onStartImport}
            onClick={onStartImport}
          >
            <FileUp size={18} aria-hidden="true" />
            Start Import
          </button>
        </article>

        <article className="import-export-page__action-card">
          <div className="import-export-page__action-icon">
            <FileDown size={24} aria-hidden="true" />
          </div>

          <div>
            <h2>Export Data</h2>

            <p>
              Prepare exports of permitted workspace records
              using configured fields and access controls.
            </p>
          </div>

          <button
            type="button"
            className="import-export-page__export-button"
            disabled={!onStartExport}
            onClick={onStartExport}
          >
            <Download size={18} aria-hidden="true" />
            Start Export
          </button>
        </article>
      </section>

      <section
        className="import-export-page__section"
        aria-labelledby="data-transfer-history-title"
      >
        <div className="import-export-page__section-heading">
          <div>
            <h2 id="data-transfer-history-title">
              Transfer History
            </h2>

            <p>
              Review import and export activities available
              to your workspace.
            </p>

            <span className="import-export-page__record-count">
              {filteredRecords.length} of {records.length} records
            </span>
          </div>

          <ArrowLeftRight size={22} aria-hidden="true" />
        </div>

        <div className="import-export-page__toolbar">
          <label className="import-export-page__search">
            <Search size={18} aria-hidden="true" />

            <span className="import-export-page__sr-only">
              Search transfer history
            </span>

            <input
              type="search"
              placeholder="Search transfer history..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="import-export-page__filter">
            <ArrowLeftRight size={18} aria-hidden="true" />

            <span className="import-export-page__sr-only">
              Filter by operation
            </span>

            <select
              value={direction}
              onChange={(event) =>
                setDirection(event.target.value)
              }
            >
              <option value="all">All operations</option>
              <option value="import">Imports</option>
              <option value="export">Exports</option>
            </select>
          </label>

          <label className="import-export-page__filter">
            <SlidersHorizontal size={18} aria-hidden="true" />

            <span className="import-export-page__sr-only">
              Filter by transfer status
            </span>

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
            >
              <option value="all">All statuses</option>

              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredRecords.length > 0 ? (
          <div className="import-export-page__table-wrap">
            <table className="import-export-page__table">
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
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    {visibleColumns.map((column) => (
                      <td key={column.key}>
                        {column.key === 'name' ? (
                          <div className="import-export-page__record-main">
                            <strong>{record.name}</strong>

                            {record.description && (
                              <span>
                                {record.description}
                              </span>
                            )}
                          </div>
                        ) : (
                          displayField(record, column.key)
                        )}
                      </td>
                    ))}

                    <td>
                      <button
                        type="button"
                        className="import-export-page__view-button"
                        disabled={!onOpenRecord}
                        onClick={() => onOpenRecord?.(record)}
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
          <div className="import-export-page__empty-state">
            <ArrowLeftRight size={38} aria-hidden="true" />

            <h3>
              {records.length === 0
                ? 'No transfer history available'
                : 'No matching transfers'}
            </h3>

            <p>
              {records.length === 0
                ? 'Authorized import and export activity will appear here once data transfer services are connected.'
                : 'Try a different search term or filter.'}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}