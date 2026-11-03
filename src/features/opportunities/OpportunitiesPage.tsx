import { useMemo, useState } from 'react'

import {
    BriefcaseBusiness,
    Filter,
    Plus,
    Search,
} from 'lucide-react'

/**
 * D-GATE Silver CRM
 * Opportunities Module — Frontend
 *
 * Opportunity records, pipeline stages and
 * display columns are configuration-driven.
 *
 * No API calls, mock records, or database logic.
 */

export type OpportunityFieldValue =
    | string
    | number
    | boolean
    | null

export interface OpportunityColumn {
    readonly id: string
    readonly label: string
    readonly key: string
}

export interface OpportunityStage {
    readonly id: string
    readonly label: string
}

export interface OpportunityRecord {
    readonly id: string
    readonly stageId?: string | null
    readonly fields: Readonly<
        Record<string, OpportunityFieldValue>
    >
}

export interface OpportunitiesPageProps {
    readonly opportunities?: readonly OpportunityRecord[]
    readonly columns?: readonly OpportunityColumn[]
    readonly stages?: readonly OpportunityStage[]
    readonly onCreateOpportunity?: () => void
    readonly onOpenOpportunity?: (
        opportunity: OpportunityRecord
    ) => void
}

/**
 * Initial display preferences, not mandatory
 * customer fields or a fixed pipeline.
 */
const defaultColumns: readonly OpportunityColumn[] = [
    {
        id: 'opportunity-name',
        label: 'Opportunity Name',
        key: 'name',
    },
    {
        id: 'company',
        label: 'Company',
        key: 'company',
    },
    {
        id: 'value',
        label: 'Value',
        key: 'value',
    },
    {
        id: 'stage',
        label: 'Pipeline Stage',
        key: 'stage',
    },
    {
        id: 'owner',
        label: 'Assigned To',
        key: 'owner',
    },
    {
        id: 'expected-close',
        label: 'Expected Close',
        key: 'expectedClose',
    },
]

function formatOpportunityValue(
    value: OpportunityFieldValue | undefined
): string {
    if (value === null || value === undefined) {
        return '—'
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No'
    }

    return String(value)
}

export default function OpportunitiesPage({
    opportunities = [],
    columns = defaultColumns,
    stages = [],
    onCreateOpportunity,
    onOpenOpportunity,
}: OpportunitiesPageProps) {
    const [search, setSearch] = useState('')
    const [stageFilter, setStageFilter] = useState('')

    const stageLabels = useMemo(
        () =>
            new Map(
                stages.map((stage) => [
                    stage.id,
                    stage.label,
                ])
            ),
        [stages]
    )

    const visibleOpportunities = useMemo(() => {
        const term = search.trim().toLowerCase()

        return opportunities.filter((opportunity) => {
            const matchesStage =
                !stageFilter ||
                opportunity.stageId === stageFilter

            if (!matchesStage) {
                return false
            }

            if (!term) {
                return true
            }

            const stageLabel =
                stageLabels.get(
                    opportunity.stageId ?? ''
                ) ?? ''

            const values = [
                opportunity.id,
                stageLabel,
                ...Object.values(opportunity.fields),
            ]

            return values.some((value) =>
                String(value ?? '')
                    .toLowerCase()
                    .includes(term)
            )
        })
    }, [
        opportunities,
        search,
        stageFilter,
        stageLabels,
    ])

    function getCellValue(
        opportunity: OpportunityRecord,
        column: OpportunityColumn
    ): string {
        if (column.key === 'stage') {
            return (
                stageLabels.get(
                    opportunity.stageId ?? ''
                ) ?? '—'
            )
        }

        return formatOpportunityValue(
            opportunity.fields[column.key]
        )
    }

    return (
        <div className="opportunities-page">
            <header className="opportunities-heading">
                <div>
                    <p className="opportunities-eyebrow">
                        D-GATE / SILVER CRM
                    </p>

                    <h1>Opportunities</h1>

                    <p>
                        Track sales opportunities,
                        expected revenue, and progress
                        through your configured pipeline.
                    </p>
                </div>

                <button
                    type="button"
                    className="opportunities-create-button"
                    onClick={onCreateOpportunity}
                    disabled={!onCreateOpportunity}
                    title={
                        onCreateOpportunity
                            ? 'Create opportunity'
                            : 'Opportunity creation is not connected yet'
                    }
                >
                    <Plus
                        size={17}
                        aria-hidden="true"
                    />

                    New Opportunity
                </button>
            </header>

            <section
                className="opportunities-panel"
                aria-label="Opportunity records"
            >
                <div className="opportunities-panel-heading">
                    <div>
                        <h2>All Opportunities</h2>

                        <p aria-live="polite">
                            {visibleOpportunities.length} of{' '}
                            {opportunities.length} records
                        </p>
                    </div>

                    <BriefcaseBusiness
                        size={20}
                        aria-hidden="true"
                    />
                </div>

                <div className="opportunities-toolbar">
                    <label className="opportunities-search">
                        <Search
                            size={17}
                            aria-hidden="true"
                        />

                        <input
                            type="search"
                            value={search}
                            placeholder="Search opportunities..."
                            aria-label="Search opportunities"
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                        />
                    </label>

                    <label className="opportunities-stage-filter">
                        <Filter
                            size={16}
                            aria-hidden="true"
                        />

                        <select
                            aria-label="Filter opportunities by pipeline stage"
                            value={stageFilter}
                            disabled={stages.length === 0}
                            onChange={(event) =>
                                setStageFilter(
                                    event.target.value
                                )
                            }
                        >
                            <option value="">
                                All stages
                            </option>

                            {stages.map((stage) => (
                                <option
                                    key={stage.id}
                                    value={stage.id}
                                >
                                    {stage.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {columns.length === 0 ? (
                    <div className="opportunities-empty">
                        <BriefcaseBusiness
                            size={28}
                            aria-hidden="true"
                        />

                        <h3>No columns configured</h3>

                        <p>
                            Opportunity display columns
                            have not been configured.
                        </p>
                    </div>
                ) : (
                    <div className="opportunities-table-wrap">
                        <table className="opportunities-table">
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
                                {visibleOpportunities.map(
                                    (opportunity) => (
                                        <tr key={opportunity.id}>
                                            {columns.map(
                                                (column, index) => {
                                                    const value =
                                                        getCellValue(
                                                            opportunity,
                                                            column
                                                        )

                                                    return (
                                                        <td key={column.id}>
                                                            {index === 0 &&
                                                            onOpenOpportunity ? (
                                                                <button
                                                                    type="button"
                                                                    className="opportunities-record-link"
                                                                    onClick={() =>
                                                                        onOpenOpportunity(
                                                                            opportunity
                                                                        )
                                                                    }
                                                                    aria-label={
                                                                        `Open opportunity ${value}`
                                                                    }
                                                                >
                                                                    {value}
                                                                </button>
                                                            ) : (
                                                                value
                                                            )}
                                                        </td>
                                                    )
                                                }
                                            )}
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>

                        {visibleOpportunities.length === 0 && (
                            <div className="opportunities-empty">
                                <BriefcaseBusiness
                                    size={28}
                                    aria-hidden="true"
                                />

                                <h3>
                                    {opportunities.length === 0
                                        ? 'No opportunities available'
                                        : 'No matching opportunities'}
                                </h3>

                                <p>
                                    {opportunities.length === 0
                                        ? 'Opportunity records will appear here once data is connected.'
                                        : 'Try another search or pipeline stage.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    )
}