import { useState, type FormEvent } from 'react'
import { Bell, Menu, Search } from 'lucide-react'

export type CRMRole = 'Company Owner' | 'Manager' | 'Employee'

export interface TopbarUser {
    name: string
    role: string
}

interface TopbarProps {
    onMenuToggle: () => void
    user?: TopbarUser | null
    onSearch?: (query: string) => void
    onNotificationsClick?: () => void
    hasUnreadNotifications?: boolean
    previewRole?: CRMRole
    onPreviewRoleChange?: (role: CRMRole) => void
}

function getInitials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase()
}

export default function Topbar({
    onMenuToggle,
    user,
    onSearch,
    onNotificationsClick,
    hasUnreadNotifications = false,
    previewRole,
    onPreviewRoleChange,
}: TopbarProps) {
    const [searchQuery, setSearchQuery] = useState('')

    const displayName = user?.name || 'CRM User'
    const displayRole = user?.role || 'Workspace'
    const initials = getInitials(displayName)

    const showRolePreview =
        import.meta.env.DEV &&
        Boolean(previewRole && onPreviewRoleChange)

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const query = searchQuery.trim()

        if (!query || !onSearch) {
            return
        }

        onSearch(query)
    }

    return (
        <header className="topbar">
            <div className="topbar-left">
                <button
                    type="button"
                    className="icon-button mobile-toggle"
                    aria-label="Open navigation menu"
                    onClick={onMenuToggle}
                >
                    <Menu size={19} aria-hidden="true" />
                </button>

                <form
                    className="global-search"
                    role="search"
                    onSubmit={handleSearch}
                >
                    <Search
                        size={17}
                        strokeWidth={1.8}
                        aria-hidden="true"
                    />

                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) =>
                            setSearchQuery(event.target.value)
                        }
                        placeholder={
                            onSearch
                                ? 'Search leads, companies, contacts…'
                                : 'Search available after integration'
                        }
                        aria-label="Search CRM records"
                        disabled={!onSearch}
                    />

                    <kbd aria-hidden="true">↵</kbd>
                </form>
            </div>

            <div className="top-actions">
                {showRolePreview && (
                    <label className="role-switch">
                        <span>VIEW AS</span>

                        <select
                            aria-label="Preview CRM role"
                            value={previewRole}
                            onChange={(event) =>
                                onPreviewRoleChange?.(
                                    event.target.value as CRMRole
                                )
                            }
                        >
                            <option value="Company Owner">
                                Company Owner
                            </option>

                            <option value="Manager">
                                Manager
                            </option>

                            <option value="Employee">
                                Employee
                            </option>
                        </select>
                    </label>
                )}

                <button
                    type="button"
                    className="icon-button notification-button"
                    aria-label="View notifications"
                    title={
                        onNotificationsClick
                            ? 'Notifications'
                            : 'Notifications not connected'
                    }
                    onClick={onNotificationsClick}
                    disabled={!onNotificationsClick}
                >
                    <Bell
                        size={18}
                        strokeWidth={1.8}
                        aria-hidden="true"
                    />

                    {hasUnreadNotifications && (
                        <span
                            className="notif-dot"
                            aria-hidden="true"
                        />
                    )}
                </button>

                <div className="profile">
                    <div
                        className="avatar"
                        aria-hidden="true"
                    >
                        {initials}
                    </div>

                    <div className="user-meta">
                        <strong>{displayName}</strong>
                        <small>{displayRole}</small>
                    </div>
                </div>
            </div>
        </header>
    )
}