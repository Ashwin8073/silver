import { useMemo, useState } from 'react'
import {
  BarChart3,
  Download,
  FileBarChart2,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react'

export type ReportMetric = {
  id: string
  label: string
  value: string | number
  description?: string
  trendLabel?: string
}

export type ReportDefinition = {
  id: string
  name: string
  description?: string
  category?: string
  updatedAt?: string
}

export type ReportsPageProps = {
  metrics?: readonly ReportMetric[]
  reports?: readonly ReportDefinition[]
  onCreateReport?: () => void
  onOpenReport?: (report: ReportDefinition) => void
  onExport?: () => void
}

export default function ReportsPage({
  metrics = [],
  reports = [],
  onCreateReport,
  onOpenReport,
  onExport,
}: ReportsPageProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const categories = useMemo(() => {
    const values = reports
      .map((report) => report.category)
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [reports])

  const filteredReports = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()

    return reports.filter((report) => {
      const categoryMatches =
        category === 'all' || report.category === category

      const searchable = [
        report.name,
        report.description ?? '',
        report.category ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase()

      return categoryMatches && searchable.includes(query)
    })
  }, [reports, search, category])

  return (
    <main className="reports-page">
      <header className="reports-page__header">
        <div>
          <p className="reports-page__eyebrow">
            D-GATE / SILVER CRM
          </p>

          <h1>Reports &amp; Analytics</h1>

          <p className="reports-page__description">
            Explore business performance, reporting insights,
            and configurable analytics for your workspace.
          </p>
        </div>

        <button
          className="reports-page__create-button"
          type="button"
          disabled={!onCreateReport}
          onClick={onCreateReport}
        >
          <Plus size={18} aria-hidden="true" />
          Create Report
        </button>
      </header>

      <section
        className="reports-page__section"
        aria-labelledby="reports-overview-title"
      >
        <div className="reports-page__section-heading">
          <div>
            <h2 id="reports-overview-title">
              Performance Overview
            </h2>
            <p>
              Key business metrics configured for your workspace.
            </p>
          </div>

          <BarChart3 size={22} aria-hidden="true" />
        </div>

        {metrics.length > 0 ? (
          <div className="reports-page__metrics">
            {metrics.map((metric) => (
              <article
                className="reports-page__metric"
                key={metric.id}
              >
                <p className="reports-page__metric-label">
                  {metric.label}
                </p>

                <strong className="reports-page__metric-value">
                  {metric.value}
                </strong>

                {metric.description && (
                  <p className="reports-page__metric-description">
                    {metric.description}
                  </p>
                )}

                {metric.trendLabel && (
                  <p className="reports-page__metric-trend">
                    {metric.trendLabel}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="reports-page__empty-overview">
            <BarChart3 size={34} aria-hidden="true" />
            <h3>No analytics data available</h3>
            <p>
              Authorized performance metrics will appear here
              once reporting data is connected.
            </p>
          </div>
        )}
      </section>

      <section
        className="reports-page__section"
        aria-labelledby="reports-library-title"
      >
        <div className="reports-page__section-heading">
          <div>
            <h2 id="reports-library-title">Report Library</h2>
            <p>
              Browse reports available to your workspace.
            </p>
            <span className="reports-page__record-count">
              {filteredReports.length} of {reports.length} reports
            </span>
          </div>

          <FileBarChart2 size={22} aria-hidden="true" />
        </div>

        <div className="reports-page__toolbar">
          <label className="reports-page__search">
            <Search size={18} aria-hidden="true" />
            <span className="reports-page__sr-only">
              Search reports
            </span>
            <input
              type="search"
              placeholder="Search reports..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="reports-page__filter">
            <SlidersHorizontal size={18} aria-hidden="true" />
            <span className="reports-page__sr-only">
              Filter reports by category
            </span>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">All categories</option>

              {categories.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <button
            className="reports-page__export-button"
            type="button"
            disabled={!onExport}
            onClick={onExport}
          >
            <Download size={18} aria-hidden="true" />
            Export
          </button>
        </div>

        {filteredReports.length > 0 ? (
          <div className="reports-page__table-wrap">
            <table className="reports-page__table">
              <thead>
                <tr>
                  <th scope="col">Report Name</th>
                  <th scope="col">Category</th>
                  <th scope="col">Last Updated</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <strong>{report.name}</strong>
                      {report.description && (
                        <span className="reports-page__row-description">
                          {report.description}
                        </span>
                      )}
                    </td>

                    <td>{report.category || '—'}</td>
                    <td>{report.updatedAt || '—'}</td>

                    <td>
                      <button
                        className="reports-page__open-button"
                        type="button"
                        disabled={!onOpenReport}
                        onClick={() => onOpenReport?.(report)}
                      >
                        Open Report
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="reports-page__empty-library">
            <FileBarChart2 size={36} aria-hidden="true" />

            <h3>
              {reports.length === 0
                ? 'No reports available'
                : 'No matching reports'}
            </h3>

            <p>
              {reports.length === 0
                ? 'Reports will appear here when authorized reporting data is connected.'
                : 'Try a different search term or category filter.'}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}