/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  Box,
  ChartLine,
  ClockArrowUp,
  CreditCard,
  LayoutDashboard,
  List,
  LockKeyhole,
  MessageSquareText,
  Radio,
  ServerCog,
  Settings,
  Ticket,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SidebarData } from '@/components/layout/types'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
} from '@/lib/admin-permissions'
import { ROLE } from '@/lib/roles'

/**
 * Root navigation groups for the application sidebar.
 *
 * These are shown when the URL does not match any nested sidebar view
 * registered in `layout/lib/sidebar-view-registry.ts`.
 *
 * The first three groups mirror the FairRouter console design, which only
 * covers a member's own surfaces. Administration is outside that design but
 * keeps its group, declared with what each entry demands of the account:
 * `useSidebarView` drops the group below admin and drops individual entries by
 * their `requiredRole` / `requiredCapability`.
 */
export function useSidebarData(): SidebarData {
  const { t } = useTranslation()

  return {
    navGroups: [
      {
        id: 'chat',
        title: t('Chat'),
        items: [
          {
            title: t('Playground'),
            url: '/playground',
            icon: MessageSquareText,
          },
        ],
      },
      {
        id: 'general',
        title: t('API'),
        items: [
          {
            title: t('Dashboard'),
            url: '/dashboard',
            icon: ChartLine,
          },
          {
            title: t('API Keys'),
            url: '/keys',
            icon: LockKeyhole,
          },
          {
            title: t('Request Logs'),
            url: '/usage-logs/common',
            icon: List,
          },
          {
            title: t('Async Tasks'),
            url: '/usage-logs/task',
            activeUrls: ['/usage-logs/drawing'],
            configUrls: ['/usage-logs/drawing', '/usage-logs/task'],
            icon: ClockArrowUp,
          },
        ],
      },
      {
        id: 'personal',
        title: t('Account'),
        items: [
          {
            title: t('Credits'),
            url: '/wallet',
            icon: CreditCard,
          },
          {
            title: t('Account Settings'),
            url: '/profile',
            icon: Settings,
          },
        ],
      },
      {
        id: 'admin',
        title: t('Admin'),
        items: [
          {
            title: t('Channels'),
            url: '/channels',
            icon: Radio,
            requiredCapability: {
              resource: ADMIN_PERMISSION_RESOURCES.CHANNEL,
              action: ADMIN_PERMISSION_ACTIONS.READ,
            },
          },
          {
            title: t('Models'),
            url: '/models/metadata',
            icon: Box,
          },
          {
            title: t('Users'),
            url: '/users',
            icon: Users,
          },
          {
            // checkIsActive matches the exact path, so the other sections
            // need listing or the entry un-highlights when you switch tabs.
            title: t('Admin Dashboard'),
            url: '/admin-dashboard/overview',
            activeUrls: [
              '/admin-dashboard/models',
              '/admin-dashboard/flow',
              '/admin-dashboard/users',
            ],
            icon: LayoutDashboard,
          },
          {
            title: t('Redemption Codes'),
            url: '/redemption-codes',
            icon: Ticket,
          },
          {
            title: t('Subscriptions'),
            url: '/subscriptions',
            icon: CreditCard,
          },
          {
            title: t('System Info'),
            url: '/system-info',
            icon: ServerCog,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            // Super admin only, matching the route guard and the backend's
            // `admin.setting: false` for plain admins. Without this an admin
            // saw the entry and got a 403 on click.
            title: t('System Settings'),
            url: '/system-settings/site',
            activeUrls: ['/system-settings'],
            icon: Settings,
            requiredRole: ROLE.SUPER_ADMIN,
          },
        ],
      },
    ],
  }
}
