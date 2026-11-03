/**
 * D-GATE Silver CRM
 * Centralized navigation configuration.
 *
 * UI Reference: CRM Interactive Prototype v2.0
 *
 * Navigation definitions do not authorize access.
 * Permission and feature gates are handled separately.
 */

export interface NavigationItem {
    readonly id: string;
    readonly label: string;
    readonly path: string;
    readonly icon: string;
}

export interface NavigationSection {
    readonly title: string;
    readonly items: readonly NavigationItem[];
}

export const navigationSections: readonly NavigationSection[] = [
    {
        title: 'WORKSPACE',
        items: [
            {
                id: 'dashboard',
                label: 'Dashboard',
                path: '/dashboard',
                icon: 'layout-dashboard',
            },
            {
                id: 'leads',
                label: 'Leads',
                path: '/leads',
                icon: 'target',
            },
            {
                id: 'companies',
                label: 'Companies',
                path: '/companies',
                icon: 'building-2',
            },
            {
                id: 'contacts',
                label: 'My Contacts',
                path: '/contacts',
                icon: 'contact',
            },
            {
                id: 'opportunities',
                label: 'Opportunities',
                path: '/opportunities',
                icon: 'briefcase-business',
            },
            {
                id: 'tasks',
                label: 'Tasks & Follow-ups',
                path: '/tasks',
                icon: 'check-circle-2',
            },
            {
                id: 'calendar',
                label: 'Calendar',
                path: '/calendar',
                icon: 'calendar-days',
            },
            {
                id: 'employees',
                label: 'Employees',
                path: '/employees',
                icon: 'users',
            },
            {
                id: 'reports',
                label: 'Reports & Analytics',
                path: '/reports',
                icon: 'chart-no-axes-column',
            },
        ],
    },
    {
        title: 'COMMERCIAL',
        items: [
            {
                id: 'products',
                label: 'Products & Services',
                path: '/products',
                icon: 'package',
            },
            {
                id: 'quotations',
                label: 'Quotations',
                path: '/quotations',
                icon: 'file-text',
            },
            {
                id: 'negotiations',
                label: 'Negotiations',
                path: '/negotiations',
                icon: 'messages-square',
            },
            {
                id: 'purchase-orders',
                label: 'Purchase Orders',
                path: '/purchase-orders',
                icon: 'receipt',
            },
            {
                id: 'invoices',
                label: 'Invoices',
                path: '/invoices',
                icon: 'file-check',
            },
            {
                id: 'payments',
                label: 'Payments',
                path: '/payments',
                icon: 'wallet',
            },
        ],
    },
    {
        title: 'TOOLS',
        items: [
            {
                id: 'import-export',
                label: 'Import / Export',
                path: '/import-export',
                icon: 'arrow-left-right',
            },
            {
                id: 'ai-copilot',
                label: 'AI Copilot',
                path: '/ai-copilot',
                icon: 'sparkles',
            },
        ],
    },
    {
        title: 'WORKSPACE SETTINGS',
        items: [
            {
                id: 'settings',
                label: 'Settings',
                path: '/settings',
                icon: 'settings',
            },
        ],
    },
];