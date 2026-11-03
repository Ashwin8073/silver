import { NavLink } from 'react-router'

import {
    ArrowLeftRight,
    ArrowRight,
    BriefcaseBusiness,
    Building2,
    CalendarDays,
    ChartNoAxesColumn,
    CheckCircle2,
    Contact,
    FileCheck,
    FileText,
    Layers,
    LayoutDashboard,
    MessagesSquare,
    Package,
    Receipt,
    Settings,
    Sparkles,
    Target,
    Users,
    Wallet,
    type LucideIcon,
} from 'lucide-react'

import { navigationSections } from '../app/navigation'

interface SidebarProps {
    isOpen: boolean
    onClose: () => void
}

const iconMap: Record<string, LucideIcon> = {
    'layout-dashboard': LayoutDashboard,
    target: Target,
    'building-2': Building2,
    contact: Contact,
    'briefcase-business': BriefcaseBusiness,
    'check-circle-2': CheckCircle2,
    'calendar-days': CalendarDays,
    users: Users,
    'chart-no-axes-column': ChartNoAxesColumn,
    package: Package,
    'file-text': FileText,
    'messages-square': MessagesSquare,
    receipt: Receipt,
    'file-check': FileCheck,
    wallet: Wallet,
    'arrow-left-right': ArrowLeftRight,
    sparkles: Sparkles,
    settings: Settings,
}

export default function Sidebar({
    isOpen,
    onClose,
}: SidebarProps) {
    return (
        <>
            <button
                type="button"
                className={`sidebar-shade${isOpen ? ' open' : ''}`}
                aria-label="Close navigation"
                aria-hidden={!isOpen}
                tabIndex={isOpen ? 0 : -1}
                onClick={onClose}
            />

            <aside
                className={`sidebar${isOpen ? ' open' : ''}`}
                aria-label="CRM navigation"
            >
                <div className="brand">
                    <div className="logo" aria-hidden="true">
                        D<span></span>
                    </div>

                    <div>
                        <div className="brand-title">
                            D-GATE CRM
                        </div>

                        <div className="brand-sub">
                            Silver workspace
                        </div>
                    </div>
                </div>

                <nav
                    className="snav"
                    aria-label="Primary CRM navigation"
                >
                    {navigationSections.map((section) => (
                        <div
                            className="nav-section"
                            key={section.title}
                        >
                            <div className="nav-head">
                                {section.title}
                            </div>

                            {section.items.map((item) => {
                                const ItemIcon =
                                    iconMap[item.icon] ??
                                    LayoutDashboard

                                return (
                                    <NavLink
                                        key={item.id}
                                        to={item.path}
                                        end
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            `nav-item${
                                                isActive
                                                    ? ' active'
                                                    : ''
                                            }`
                                        }
                                    >
                                        <ItemIcon
                                            size={17}
                                            strokeWidth={1.8}
                                            aria-hidden="true"
                                        />

                                        <span>
                                            {item.label}
                                        </span>
                                    </NavLink>
                                )
                            })}
                        </div>
                    ))}
                </nav>

                <div className="side-foot">
                    <div className="side-plan">
                        <div className="plan-top">
                            <Layers
                                size={15}
                                aria-hidden="true"
                            />

                            <span>
                                Silver plan · preview
                            </span>
                        </div>

                        <p>
                            One connected workspace.
                            Advanced modules can be
                            added later.
                        </p>

                        <NavLink
                            to="/settings"
                            onClick={onClose}
                            className="side-plan-link"
                        >
                            Explore future upgrades

                            <ArrowRight
                                size={13}
                                aria-hidden="true"
                            />
                        </NavLink>
                    </div>
                </div>
            </aside>
        </>
    )
}