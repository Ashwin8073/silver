import { useState } from 'react'
import { Outlet } from 'react-router'

import Sidebar from './Sidebar'
import Topbar, {
    type CRMRole,
    type TopbarUser,
} from './Topbar'

export interface CRMLayoutProps {
    user?: TopbarUser | null
    onSearch?: (query: string) => void
    onNotificationsClick?: () => void
    hasUnreadNotifications?: boolean
    previewRole?: CRMRole
    onPreviewRoleChange?: (role: CRMRole) => void
}

/**
 * D-GATE Silver CRM — Shared Application Layout
 *
 * Reference: Interactive UI/UX Prototype v2.0
 *
 * This is a presentation layout.
 * Authentication and authorization are handled separately.
 */
export default function CRMLayout({
    user,
    onSearch,
    onNotificationsClick,
    hasUnreadNotifications = false,
    previewRole,
    onPreviewRoleChange,
}: CRMLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    function closeSidebar() {
        setIsSidebarOpen(false)
    }

    function toggleSidebar() {
        setIsSidebarOpen((current) => !current)
    }

    return (
        <div className="app-shell">
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={closeSidebar}
            />

            <div className="work-area">
                <Topbar
                    onMenuToggle={toggleSidebar}
                    user={user}
                    onSearch={onSearch}
                    onNotificationsClick={onNotificationsClick}
                    hasUnreadNotifications={hasUnreadNotifications}
                    previewRole={previewRole}
                    onPreviewRoleChange={onPreviewRoleChange}
                />

                <main
                    id="main-content"
                    className="page"
                    aria-label="CRM workspace"
                >
                    <Outlet />
                </main>
            </div>
        </div>
    )
}