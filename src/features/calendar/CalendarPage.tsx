import { useMemo, useState } from 'react'

import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Filter,
    Plus,
} from 'lucide-react'

/**
 * D-GATE Silver CRM
 * Calendar Module — Frontend
 *
 * Events and activity types are supplied through props.
 * The parent will provide authenticated data later.
 *
 * No API calls, persistent storage, or mock events.
 */

export interface CalendarActivityType {
    readonly id: string
    readonly label: string
}

export interface CalendarEntry {
    readonly id: string
    readonly title: string
    readonly date: string
    readonly startTime?: string
    readonly endTime?: string
    readonly typeId?: string | null
    readonly description?: string
}

export interface CalendarPageProps {
    readonly events?: readonly CalendarEntry[]
    readonly activityTypes?: readonly CalendarActivityType[]
    readonly weekStartsOn?: 0 | 1
    readonly onCreateEvent?: (date: string) => void
    readonly onOpenEvent?: (event: CalendarEntry) => void
}

const emptyEvents: readonly CalendarEntry[] = []
const emptyTypes: readonly CalendarActivityType[] = []

const sundayFirst = [
    'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
]

const mondayFirst = [
    'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
]

function dateKey(date: Date): string {
    const year = String(date.getFullYear()).padStart(4, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

function validDateKey(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

    if (!match) {
        return false
    }

    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])

    const parsed = new Date(
        Date.UTC(year, month - 1, day)
    )

    return (
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
    )
}

function dateFromKey(value: string): Date {
    const [year, month, day] = value.split('-').map(Number)

    return new Date(year, month - 1, day)
}

export default function CalendarPage({
    events = emptyEvents,
    activityTypes = emptyTypes,
    weekStartsOn = 1,
    onCreateEvent,
    onOpenEvent,
}: CalendarPageProps) {
    const [visibleMonth, setVisibleMonth] = useState(
        () => {
            const now = new Date()

            return new Date(
                now.getFullYear(),
                now.getMonth(),
                1
            )
        }
    )

    const [selectedDate, setSelectedDate] = useState(
        () => dateKey(new Date())
    )

    const [typeFilter, setTypeFilter] = useState('')

    const activeTypeFilter = activityTypes.some(
        (type) => type.id === typeFilter
    ) ? typeFilter : ''

    const typeLabels = useMemo(
        () => new Map(
            activityTypes.map((type) => [
                type.id,
                type.label,
            ])
        ),
        [activityTypes]
    )

    const filteredEvents = useMemo(
        () => events
            .filter((event) =>
                validDateKey(event.date) &&
                (
                    !activeTypeFilter ||
                    event.typeId === activeTypeFilter
                )
            )
            .slice()
            .sort((left, right) =>
                (left.startTime ?? '').localeCompare(
                    right.startTime ?? ''
                ) ||
                left.title.localeCompare(right.title)
            ),
        [events, activeTypeFilter]
    )

    const eventsByDate = useMemo(() => {
        const grouped = new Map<
            string,
            CalendarEntry[]
        >()

        for (const event of filteredEvents) {
            const existing = grouped.get(event.date)

            if (existing) {
                existing.push(event)
            } else {
                grouped.set(event.date, [event])
            }
        }

        return grouped
    }, [filteredEvents])

    const monthLabel = visibleMonth.toLocaleDateString(
        'en-IN',
        {
            month: 'long',
            year: 'numeric',
        }
    )

    const currentMonthKey = [
        visibleMonth.getFullYear(),
        String(visibleMonth.getMonth() + 1).padStart(2, '0'),
    ].join('-')

    const monthEventCount = filteredEvents.filter(
        (event) => event.date.startsWith(
            `${currentMonthKey}-`
        )
    ).length

    const calendarDays = useMemo(() => {
        const year = visibleMonth.getFullYear()
        const month = visibleMonth.getMonth()

        const firstDay = new Date(year, month, 1)

        const offset = (
            firstDay.getDay() - weekStartsOn + 7
        ) % 7

        return Array.from(
            { length: 42 },
            (_, index) => {
                const date = new Date(
                    year,
                    month,
                    index - offset + 1
                )

                return {
                    date,
                    key: dateKey(date),
                    day: date.getDate(),
                    isCurrentMonth:
                        date.getMonth() === month,
                }
            }
        )
    }, [visibleMonth, weekStartsOn])

    const today = dateKey(new Date())
    const selectedEvents = eventsByDate.get(
        selectedDate
    ) ?? []

    const selectedDateLabel = dateFromKey(
        selectedDate
    ).toLocaleDateString(
        'en-IN',
        {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }
    )

    function changeMonth(offset: number): void {
        const next = new Date(
            visibleMonth.getFullYear(),
            visibleMonth.getMonth() + offset,
            1
        )

        setVisibleMonth(next)
        setSelectedDate(dateKey(next))
    }

    function jumpToToday(): void {
        const now = new Date()

        setVisibleMonth(
            new Date(
                now.getFullYear(),
                now.getMonth(),
                1
            )
        )

        setSelectedDate(dateKey(now))
    }

    function selectDay(date: Date): void {
        setSelectedDate(dateKey(date))

        if (
            date.getFullYear() !==
                visibleMonth.getFullYear() ||
            date.getMonth() !==
                visibleMonth.getMonth()
        ) {
            setVisibleMonth(
                new Date(
                    date.getFullYear(),
                    date.getMonth(),
                    1
                )
            )
        }
    }

    const weekdays = weekStartsOn === 1
        ? mondayFirst
        : sundayFirst

    return (
        <div className="calendar-page">
            <header className="calendar-heading">
                <div>
                    <p className="calendar-eyebrow">
                        D-GATE / SILVER CRM
                    </p>

                    <h1>Calendar</h1>

                    <p>
                        View scheduled activities, meetings,
                        tasks, and follow-ups in one place.
                    </p>
                </div>

                <button
                    type="button"
                    className="calendar-create-button"
                    disabled={!onCreateEvent}
                    onClick={() =>
                        onCreateEvent?.(selectedDate)
                    }
                    title={
                        onCreateEvent
                            ? 'Create an activity'
                            : 'Activity creation is not connected yet'
                    }
                >
                    <Plus size={17} aria-hidden="true" />
                    New Activity
                </button>
            </header>

            <section
                className="calendar-panel"
                aria-label="Activity calendar"
            >
                <div className="calendar-toolbar">
                    <div className="calendar-month-heading">
                        <CalendarDays
                            size={20}
                            aria-hidden="true"
                        />

                        <div>
                            <h2>{monthLabel}</h2>

                            <p aria-live="polite">
                                {monthEventCount} scheduled
                                {' '}
                                {monthEventCount === 1
                                    ? 'activity'
                                    : 'activities'}
                            </p>
                        </div>
                    </div>

                    <div className="calendar-toolbar-actions">
                        <label className="calendar-type-filter">
                            <Filter
                                size={16}
                                aria-hidden="true"
                            />

                            <select
                                aria-label="Filter calendar by activity type"
                                value={activeTypeFilter}
                                disabled={
                                    activityTypes.length === 0
                                }
                                onChange={(event) =>
                                    setTypeFilter(
                                        event.target.value
                                    )
                                }
                            >
                                <option value="">
                                    All activity types
                                </option>

                                {activityTypes.map((type) => (
                                    <option
                                        key={type.id}
                                        value={type.id}
                                    >
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <button
                            type="button"
                            className="calendar-today-button"
                            onClick={jumpToToday}
                        >
                            Today
                        </button>

                        <div className="calendar-navigation">
                            <button
                                type="button"
                                onClick={() => changeMonth(-1)}
                                aria-label="Previous month"
                            >
                                <ChevronLeft
                                    size={19}
                                    aria-hidden="true"
                                />
                            </button>

                            <button
                                type="button"
                                onClick={() => changeMonth(1)}
                                aria-label="Next month"
                            >
                                <ChevronRight
                                    size={19}
                                    aria-hidden="true"
                                />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="calendar-grid-wrap">
                    <div
                        className="calendar-month-grid"
                        role="group"
                        aria-label={`Dates for ${monthLabel}`}
                    >
                        {weekdays.map((weekday) => (
                            <div
                                className="calendar-weekday"
                                key={weekday}
                            >
                                {weekday}
                            </div>
                        ))}

                        {calendarDays.map((day) => {
                            const dayEvents =
                                eventsByDate.get(day.key) ?? []

                            const classes = [
                                'calendar-day',
                                !day.isCurrentMonth
                                    ? 'calendar-day--outside'
                                    : '',
                                day.key === selectedDate
                                    ? 'calendar-day--selected'
                                    : '',
                                day.key === today
                                    ? 'calendar-day--today'
                                    : '',
                            ].filter(Boolean).join(' ')

                            return (
                                <div
                                    key={day.key}
                                    className={classes}
                                >
                                    <button
                                        type="button"
                                        className="calendar-day-select"
                                        onClick={() =>
                                            selectDay(day.date)
                                        }
                                        aria-pressed={
                                            day.key === selectedDate
                                        }
                                        aria-label={
                                            `${day.date.toLocaleDateString(
                                                'en-IN',
                                                {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric',
                                                }
                                            )}, ${dayEvents.length} activities`
                                        }
                                    >
                                        {day.day}
                                    </button>

                                    <div className="calendar-day-events">
                                        {dayEvents
                                            .slice(0, 2)
                                            .map((event) => (
                                                <span
                                                    key={event.id}
                                                    className="calendar-event-chip"
                                                    title={event.title}
                                                >
                                                    {event.title}
                                                </span>
                                            ))}

                                        {dayEvents.length > 2 && (
                                            <span className="calendar-more">
                                                +{dayEvents.length - 2} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section
                className="calendar-agenda"
                aria-label="Activities for selected date"
            >
                <div className="calendar-agenda-heading">
                    <div>
                        <h2>Selected Day</h2>
                        <p>{selectedDateLabel}</p>
                    </div>

                    <span className="calendar-agenda-count">
                        {selectedEvents.length}
                        {' '}
                        {selectedEvents.length === 1
                            ? 'activity'
                            : 'activities'}
                    </span>
                </div>

                {selectedEvents.length === 0 ? (
                    <div className="calendar-agenda-empty">
                        <CalendarDays
                            size={28}
                            aria-hidden="true"
                        />

                        <h3>No activities scheduled</h3>

                        <p>
                            Scheduled activities will appear
                            here when data is connected.
                        </p>
                    </div>
                ) : (
                    <ul className="calendar-agenda-list">
                        {selectedEvents.map((event) => (
                            <li
                                key={event.id}
                                className="calendar-agenda-item"
                            >
                                <div>
                                    {onOpenEvent ? (
                                        <button
                                            type="button"
                                            className="calendar-event-link"
                                            onClick={() =>
                                                onOpenEvent(event)
                                            }
                                        >
                                            {event.title}
                                        </button>
                                    ) : (
                                        <strong>{event.title}</strong>
                                    )}

                                    <p>
                                        {typeLabels.get(
                                            event.typeId ?? ''
                                        ) ?? 'Activity'}
                                    </p>

                                    {event.description && (
                                        <p>
                                            {event.description}
                                        </p>
                                    )}
                                </div>

                                {event.startTime && (
                                    <span className="calendar-event-time">
                                        <Clock3
                                            size={15}
                                            aria-hidden="true"
                                        />

                                        {event.startTime}

                                        {event.endTime
                                            ? ` – ${event.endTime}`
                                            : ''}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}