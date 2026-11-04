import { useMemo, useState } from 'react'
import {
  Bell,
  Building2,
  ChevronRight,
  LayoutDashboard,
  LockKeyhole,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Workflow,
} from 'lucide-react'

export type SettingsWorkspace = {
  name?: string
  timezone?: string
  planLabel?: string
}

export type SettingsArea = {
  id: string
  title: string
  description: string
  category: string
  icon?: string
  statusLabel?: string
}

export type SettingsPageProps = {
  workspace?: SettingsWorkspace
  areas?: readonly SettingsArea[]
  onOpenArea?: (area: SettingsArea) => void
}

const defaultAreas: readonly SettingsArea[] = [
  {
    id: 'workspace-profile',
    title: 'Workspace Profile',
    description:
      'Manage your company information and workspace identity.',
    category: 'Workspace',
    icon: 'building',
  },
  {
    id: 'team-permissions',
    title: 'Team & Permissions',
    description:
      'Review employee access, roles, and workspace permissions.',
    category: 'Access & Security',
    icon: 'users',
  },
  {
    id: 'forms-fields',
    title: 'Custom Forms & Fields',
    description:
      'Configure fields and forms for your company and CRM modules.',
    category: 'Customization',
    icon: 'fields',
  },
  {
    id: 'status-pipelines',
    title: 'Status Pipelines',
    description:
      'Manage company-specific statuses and workflow stages.',
    category: 'Customization',
    icon: 'workflow',
  },
  {
    id: 'dashboard-cards',
    title: 'Dashboard Configuration',
    description:
      'Choose and organize configurable workspace dashboard cards.',
    category: 'Customization',
    icon: 'dashboard',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description:
      'Manage workspace notification and alert preferences.',
    category: 'Workspace',
    icon: 'notifications',
  },
  {
    id: 'preferences',
    title: 'Workspace Preferences',
    description:
      'Review regional settings and company-specific preferences.',
    category: 'Workspace',
    icon: 'settings',
  },
  {
    id: 'security',
    title: 'Security & Audit',
    description:
      'Review security settings and authorized audit access.',
    category: 'Access & Security',
    icon: 'security',
  },
]

const iconComponents = {
  building: Building2,
  users: Users,
  fields: SlidersHorizontal,
  workflow: Workflow,
  dashboard: LayoutDashboard,
  notifications: Bell,
  settings: Settings2,
  security: LockKeyhole,
}

function AreaIcon({ name }: { name?: string }) {
  const key = name as keyof typeof iconComponents
  const IconComponent = iconComponents[key] ?? Settings2

  return <IconComponent size={21} aria-hidden="true" />
}

export default function SettingsPage({
  workspace,
  areas = defaultAreas,
  onOpenArea,
}: SettingsPageProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const categories = useMemo(() => {
    const values = areas
      .map((area) => area.category.trim())
      .filter((value) => value.length > 0)

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [areas])

  const filteredAreas = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()

    return areas.filter((area) => {
      if (
        category !== 'all' &&
        area.category !== category
      ) {
        return false
      }

      const searchable = [
        area.title,
        area.description,
        area.category,
        area.statusLabel ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase()

      return searchable.includes(query)
    })
  }, [areas, search, category])

  return (
    <main className="settings-page">
      <header className="settings-page__header">
        <p className="settings-page__eyebrow">
          D-GATE / SILVER CRM
        </p>

        <h1>Settings</h1>

        <p className="settings-page__description">
          Configure your workspace, customize CRM modules,
          and manage company preferences and access.
        </p>
      </header>

      <section
        className="settings-page__workspace"
        aria-labelledby="settings-workspace-title"
      >
        <div className="settings-page__workspace-icon">
          <Building2 size={25} aria-hidden="true" />
        </div>

        <div className="settings-page__workspace-content">
          <h2 id="settings-workspace-title">
            Company Workspace
          </h2>

          <p className="settings-page__workspace-name">
            {workspace?.name ?? 'Workspace details not connected'}
          </p>

          <div className="settings-page__workspace-details">
            <span>
              Timezone:{' '}
              <strong>{workspace?.timezone ?? '—'}</strong>
            </span>

            <span>
              Plan:{' '}
              <strong>{workspace?.planLabel ?? '—'}</strong>
            </span>
          </div>
        </div>
      </section>

      <section
        className="settings-page__section"
        aria-labelledby="settings-directory-title"
      >
        <div className="settings-page__section-heading">
          <div>
            <h2 id="settings-directory-title">
              Workspace Configuration
            </h2>

            <p>
              Browse settings available for your workspace.
            </p>

            <span className="settings-page__record-count">
              {filteredAreas.length} of {areas.length} settings areas
            </span>
          </div>

          <Settings2 size={22} aria-hidden="true" />
        </div>

        <div className="settings-page__toolbar">
          <label className="settings-page__search">
            <Search size={18} aria-hidden="true" />

            <span className="settings-page__sr-only">
              Search settings
            </span>

            <input
              type="search"
              placeholder="Search settings..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </label>

          <label className="settings-page__filter">
            <SlidersHorizontal
              size={18}
              aria-hidden="true"
            />

            <span className="settings-page__sr-only">
              Filter settings by category
            </span>

            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
            >
              <option value="all">All categories</option>

              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredAreas.length > 0 ? (
          <div className="settings-page__grid">
            {filteredAreas.map((area) => (
              <article
                key={area.id}
                className="settings-page__card"
              >
                <div className="settings-page__card-icon">
                  <AreaIcon name={area.icon} />
                </div>

                <div className="settings-page__card-content">
                  <span className="settings-page__category">
                    {area.category}
                  </span>

                  <h3>{area.title}</h3>

                  <p>{area.description}</p>

                  {area.statusLabel && (
                    <span className="settings-page__status">
                      {area.statusLabel}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="settings-page__open-button"
                  disabled={!onOpenArea}
                  onClick={() => onOpenArea?.(area)}
                  aria-label={`Open ${area.title} settings`}
                >
                  Open Settings
                  <ChevronRight
                    size={17}
                    aria-hidden="true"
                  />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="settings-page__empty-state">
            <Settings2 size={37} aria-hidden="true" />

            <h3>
              {areas.length === 0
                ? 'No settings areas available'
                : 'No matching settings'}
            </h3>

            <p>
              {areas.length === 0
                ? 'Authorized settings will appear when workspace configuration is connected.'
                : 'Try another search term or category.'}
            </p>
          </div>
        )}
      </section>

      <div className="settings-page__security-note">
        <ShieldCheck size={20} aria-hidden="true" />

        <p>
          Settings changes require authorized backend
          integration. Access and permissions must always
          be enforced by the connected service.
        </p>
      </div>
    </main>
  )
}