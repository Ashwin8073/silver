import { Link } from 'react-router'

import {
    Activity,
    ArrowRight,
    CalendarClock,
    ChartNoAxesColumn,
    Clock3,
    Target,
    TrendingUp,
    Wallet,
    type LucideIcon,
} from 'lucide-react'

export interface DashboardMetric {
    id: string
    label: string
    value: string | number | null
    description?: string
    icon?: string
}

export interface DashboardLeadStatus {
    id: string
    name: string
    count: number
    color?: string
}

export interface DashboardPipelineStage {
    id: string
    name: string
    opportunityCount: number
    valueLabel?: string
}

export interface DashboardActivity {
    id: string
    title: string
    description?: string
    timeLabel: string
}

export interface DashboardFollowUp {
    id: string
    title: string
    relatedTo?: string
    dueLabel: string
}

export interface DashboardData {
    metrics?: readonly DashboardMetric[]
    leadStatuses?: readonly DashboardLeadStatus[]
    pipelineStages?: readonly DashboardPipelineStage[]
    activities?: readonly DashboardActivity[]
    followUps?: readonly DashboardFollowUp[]
}

interface DashboardPageProps {
    data?: DashboardData | null
}

const metricIcons: Record<string, LucideIcon> = {
    leads: Target,
    opportunities: TrendingUp,
    followups: CalendarClock,
    revenue: Wallet,
}

const initialMetrics: readonly DashboardMetric[] = [
    {
        id: 'leads',
        label: 'Total Leads',
        value: null,
        description: 'Lead records',
    },
    {
        id: 'opportunities',
        label: 'Open Opportunities',
        value: null,
        description: 'Active sales opportunities',
    },
    {
        id: 'followups',
        label: 'Pending Follow-ups',
        value: null,
        description: 'Actions requiring attention',
    },
    {
        id: 'revenue',
        label: 'Total Revenue',
        value: null,
        description: 'Revenue reporting',
    },
]

function EmptyState({ message }: { message: string }) {
    return (
        <div className="dashboard-empty">
            <ChartNoAxesColumn
                size={25}
                strokeWidth={1.5}
                aria-hidden="true"
            />
            <p>{message}</p>
        </div>
    )
}

export default function DashboardPage({
    data,
}: DashboardPageProps) {
    const metrics = data?.metrics ?? initialMetrics
    const leadStatuses = data?.leadStatuses ?? []
    const pipelineStages = data?.pipelineStages ?? []
    const activities = data?.activities ?? []
    const followUps = data?.followUps ?? []

    const totalLeads = leadStatuses.reduce(
        (sum, status) => sum + Math.max(0, status.count),
        0
    )

    return (
        <div className="dashboard">
            <header className="dashboard-heading">
                <div>
                    <div className="dashboard-eyebrow">
                        D-GATE / SILVER CRM
                    </div>

                    <h1>Dashboard</h1>

                    <p>
                        Your sales workspace, activities,
                        and business overview.
                    </p>
                </div>

                <span className="dashboard-mode">
                    Workspace overview
                </span>
            </header>

            <section
                className="dashboard-metrics"
                aria-label="Dashboard key metrics"
            >
                {metrics.length === 0 ? (
                    <EmptyState message="No dashboard metrics configured." />
                ) : (
                    metrics.map((metric) => {
                        const MetricIcon =
                            metricIcons[metric.icon ?? metric.id] ??
                            Activity

                        return (
                            <article
                                className="dashboard-metric-card"
                                key={metric.id}
                            >
                                <div className="dashboard-metric-top">
                                    <span>{metric.label}</span>

                                    <div className="dashboard-metric-icon">
                                        <MetricIcon
                                            size={19}
                                            strokeWidth={1.8}
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>

                                <strong className="dashboard-metric-value">
                                    {metric.value ?? '—'}
                                </strong>

                                <p className="dashboard-metric-description">
                                    {metric.description ?? ' '}
                                </p>
                            </article>
                        )
                    })
                )}
            </section>

            <div className="dashboard-grid">
                <section className="dashboard-panel">
                    <div className="dashboard-panel-heading">
                        <div>
                            <h2>Leads by Status</h2>
                            <p>Current lead distribution</p>
                        </div>

                        <Target
                            size={19}
                            aria-hidden="true"
                        />
                    </div>

                    {leadStatuses.length === 0 ? (
                        <EmptyState message="Lead status data is not connected yet." />
                    ) : (
                        <div className="dashboard-status-list">
                            {leadStatuses.map((status) => {
                                const percentage =
                                    totalLeads > 0
                                        ? (Math.max(0, status.count) /
                                              totalLeads) *
                                          100
                                        : 0

                                return (
                                    <div
                                        className="dashboard-status-item"
                                        key={status.id}
                                    >
                                        <div className="dashboard-status-label">
                                            <span>{status.name}</span>
                                            <strong>{status.count}</strong>
                                        </div>

                                        <div className="dashboard-progress">
                                            <div
                                                className="dashboard-progress-fill"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor:
                                                        status.color ??
                                                        'var(--color-violet)',
                                                }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    <Link
                        className="dashboard-panel-link"
                        to="/leads"
                    >
                        View Leads
                        <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                </section>

                <section className="dashboard-panel">
                    <div className="dashboard-panel-heading">
                        <div>
                            <h2>Sales Pipeline</h2>
                            <p>Opportunity stages</p>
                        </div>

                        <TrendingUp
                            size={19}
                            aria-hidden="true"
                        />
                    </div>

                    {pipelineStages.length === 0 ? (
                        <EmptyState message="Pipeline data is not connected yet." />
                    ) : (
                        <div className="dashboard-pipeline">
                            {pipelineStages.map((stage) => (
                                <div
                                    className="dashboard-pipeline-row"
                                    key={stage.id}
                                >
                                    <div>
                                        <strong>{stage.name}</strong>
                                        <span>
                                            {stage.opportunityCount}
                                            {' '}opportunities
                                        </span>
                                    </div>

                                    <b>{stage.valueLabel ?? '—'}</b>
                                </div>
                            ))}
                        </div>
                    )}

                    <Link
                        className="dashboard-panel-link"
                        to="/opportunities"
                    >
                        View Opportunities
                        <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                </section>

                <section className="dashboard-panel">
                    <div className="dashboard-panel-heading">
                        <div>
                            <h2>Recent Activities</h2>
                            <p>Latest CRM activity</p>
                        </div>

                        <Activity
                            size={19}
                            aria-hidden="true"
                        />
                    </div>

                    {activities.length === 0 ? (
                        <EmptyState message="No recent activities available." />
                    ) : (
                        <div className="dashboard-activity-list">
                            {activities.map((activity) => (
                                <div
                                    className="dashboard-activity"
                                    key={activity.id}
                                >
                                    <span className="dashboard-activity-marker" />

                                    <div>
                                        <strong>{activity.title}</strong>
                                        {activity.description && (
                                            <p>{activity.description}</p>
                                        )}
                                        <small>{activity.timeLabel}</small>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="dashboard-panel">
                    <div className="dashboard-panel-heading">
                        <div>
                            <h2>Upcoming Follow-ups</h2>
                            <p>Scheduled actions</p>
                        </div>

                        <Clock3
                            size={19}
                            aria-hidden="true"
                        />
                    </div>

                    {followUps.length === 0 ? (
                        <EmptyState message="No upcoming follow-ups available." />
                    ) : (
                        <div className="dashboard-followup-list">
                            {followUps.map((followUp) => (
                                <div
                                    className="dashboard-followup"
                                    key={followUp.id}
                                >
                                    <CalendarClock
                                        size={17}
                                        aria-hidden="true"
                                    />

                                    <div>
                                        <strong>{followUp.title}</strong>
                                        {followUp.relatedTo && (
                                            <p>{followUp.relatedTo}</p>
                                        )}
                                        <small>{followUp.dueLabel}</small>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <Link
                        className="dashboard-panel-link"
                        to="/tasks"
                    >
                        View Tasks
                        <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                </section>
            </div>
        </div>
    )
}