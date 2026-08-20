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
import { createSectionRegistry } from '@/features/system-settings/utils/section-registry'

const ADMIN_DASHBOARD_SECTIONS = [
  { id: 'overview', titleKey: 'Overview', build: () => null },
  { id: 'models', titleKey: 'Model Call Analytics', build: () => null },
  { id: 'flow', titleKey: 'Flow', build: () => null },
  { id: 'users', titleKey: 'User Analytics', build: () => null },
] as const

export type AdminDashboardSectionId =
  (typeof ADMIN_DASHBOARD_SECTIONS)[number]['id']

const registry = createSectionRegistry<
  AdminDashboardSectionId,
  Record<string, never>,
  []
>({
  sections: ADMIN_DASHBOARD_SECTIONS,
  defaultSection: 'overview',
  basePath: '/admin-dashboard',
  urlStyle: 'path',
})

export const ADMIN_DASHBOARD_SECTION_IDS = registry.sectionIds
export const ADMIN_DASHBOARD_DEFAULT_SECTION = registry.defaultSection

export function isAdminDashboardSectionId(
  value: string
): value is AdminDashboardSectionId {
  return (ADMIN_DASHBOARD_SECTION_IDS as readonly string[]).includes(value)
}

export const ADMIN_DASHBOARD_SECTION_META: Record<
  AdminDashboardSectionId,
  { titleKey: string }
> = {
  overview: { titleKey: 'Overview' },
  models: { titleKey: 'Model Call Analytics' },
  flow: { titleKey: 'Flow' },
  users: { titleKey: 'User Analytics' },
}
