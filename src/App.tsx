import CalendarPage from './features/calendar/CalendarPage'
import './features/calendar/Calendar.css'
import TasksPage from './features/tasks/TasksPage'
import './features/tasks/Tasks.css'
import OpportunitiesPage from './features/opportunities/OpportunitiesPage'
import './features/opportunities/Opportunities.css'
import ContactsPage from './features/contacts/ContactsPage'
import './features/contacts/Contacts.css'
import CompaniesPage from './features/companies/CompaniesPage'
import './features/companies/Companies.css'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { navigationSections } from './app/navigation'
import CRMLayout from './layouts/CRMLayout'
import DashboardPage from './features/dashboard/DashboardPage'
import './features/dashboard/Dashboard.css'
import LeadsPage from './features/leads/LeadsPage'
import './features/leads/Leads.css'

const pages = navigationSections
    .flatMap((section) => section.items)
    .filter((page) => page.id !== 'dashboard' && page.id !== 'leads')

interface PreviewPageProps {
    title: string
}

function PreviewPage({ title }: PreviewPageProps) {
    return (
        <section style={{ maxWidth: 1250, margin: '0 auto' }}>
            <div style={{ marginBottom: 26 }}>
                <p
                    style={{
                        color: 'var(--color-copper)',
                        fontSize: 11,
                        fontWeight: 750,
                        letterSpacing: 1.5,
                        marginBottom: 9,
                    }}
                >
                    D-GATE / SILVER CRM
                </p>

                <h1
                    style={{
                        color: 'var(--color-graphite)',
                        fontSize: 26,
                        fontWeight: 800,
                        marginBottom: 9,
                    }}
                >
                    {title}
                </h1>

                <p
                    style={{
                        color: 'var(--color-text-secondary)',
                        fontSize: 13,
                        lineHeight: 1.7,
                    }}
                >
                    Workspace layout preview. Live module data and
                    actions will be connected in upcoming steps.
                </p>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns:
                        'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 16,
                    marginBottom: 20,
                }}
            >
                {[
                    'Total Records',
                    'Pending Actions',
                    'Recent Activity',
                    'Updates',
                ].map((label) => (
                    <div
                        key={label}
                        style={{
                            background: '#FFFFFF',
                            border: '1px solid #E9E7EE',
                            borderRadius: 15,
                            padding: 20,
                            boxShadow: 'var(--shadow-card)',
                        }}
                    >
                        <p
                            style={{
                                color: '#88849B',
                                fontSize: 12,
                                marginBottom: 17,
                            }}
                        >
                            {label}
                        </p>

                        <strong
                            style={{
                                color: '#242234',
                                fontSize: 27,
                            }}
                        >
                            —
                        </strong>
                    </div>
                ))}
            </div>

            <div
                style={{
                    background: '#FFFFFF',
                    border: '1px solid #E9E7EE',
                    borderRadius: 15,
                    padding: 26,
                    minHeight: 240,
                    boxShadow: 'var(--shadow-card)',
                }}
            >
                <h2
                    style={{
                        color: '#242234',
                        fontSize: 16,
                        marginBottom: 12,
                    }}
                >
                    {title} Workspace
                </h2>

                <p
                    style={{
                        color: '#88849B',
                        fontSize: 13,
                        lineHeight: 1.8,
                    }}
                >
                    The CRM application shell is now connected.
                    Feature-specific screens, real records, and
                    authorized actions will be implemented next.
                </p>
            </div>
        </section>
    )
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<CRMLayout />}>
                    <Route
                        index
                        element={
                            <Navigate to="/dashboard" replace />
                        }
                    />

                    <Route
                        path="/dashboard"
                        element={<DashboardPage />}
                    />

                    <Route path="/companies" element={<CompaniesPage />} />
                    <Route path="/contacts" element={<ContactsPage />} />
                    <Route path="/opportunities" element={<OpportunitiesPage />} />
                    <Route path="/tasks" element={<TasksPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route
                        path="/leads"
                        element={<LeadsPage />}
                    />

                    {pages.map((page) => (
                        <Route
                            key={page.id}
                            path={page.path}
                            element={
                                <PreviewPage title={page.label} />
                            }
                        />
                    ))}

                    <Route
                        path="*"
                        element={
                            <Navigate to="/dashboard" replace />
                        }
                    />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default App