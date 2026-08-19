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

const USAGE_ANALYTICS_SECTIONS = [
  { id: 'flow', titleKey: 'Flow', build: () => null },
  { id: 'users', titleKey: 'User Analytics', build: () => null },
] as const

export type UsageAnalyticsSectionId =
  (typeof USAGE_ANALYTICS_SECTIONS)[number]['id']

const registry = createSectionRegistry<
  UsageAnalyticsSectionId,
  Record<string, never>,
  []
>({
  sections: USAGE_ANALYTICS_SECTIONS,
  defaultSection: 'flow',
  basePath: '/usage-analytics',
  urlStyle: 'path',
})

export const USAGE_ANALYTICS_SECTION_IDS = registry.sectionIds
export const USAGE_ANALYTICS_DEFAULT_SECTION = registry.defaultSection

export function isUsageAnalyticsSectionId(
  value: string
): value is UsageAnalyticsSectionId {
  return (USAGE_ANALYTICS_SECTION_IDS as readonly string[]).includes(value)
}

export const USAGE_ANALYTICS_SECTION_META: Record<
  UsageAnalyticsSectionId,
  { titleKey: string }
> = {
  flow: { titleKey: 'Flow' },
  users: { titleKey: 'User Analytics' },
}
