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
  ChartLine,
  ClockArrowUp,
  CreditCard,
  List,
  LockKeyhole,
  MessageSquareText,
  Settings,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { type SidebarData } from '@/components/layout/types'

/**
 * Root navigation groups for the application sidebar.
 *
 * These are shown when the URL does not match any nested sidebar view
 * registered in `layout/lib/sidebar-view-registry.ts`.
 *
 * The three groups mirror the FairRouter console design. Administration lives
 * on the legacy console instead, so the admin routes stay reachable by URL (and
 * keep their own role guards) but have no entry here.
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
    ],
  }
}
