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
import type { DashboardRangeKey, UsageMetric } from './types'

export const RANGE_PRESETS: { key: DashboardRangeKey; labelKey: string }[] = [
  { key: 'today', labelKey: 'Today' },
  { key: 'yesterday', labelKey: 'Yesterday' },
  { key: '7days', labelKey: 'Last 7 Days' },
  { key: '30days', labelKey: 'Last 30 Days' },
]

export const USAGE_METRIC_OPTIONS: { value: UsageMetric; labelKey: string }[] =
  [
    { value: 'tokens', labelKey: 'Tokens' },
    { value: 'cost', labelKey: 'Cost' },
    { value: 'requests', labelKey: 'Requests' },
  ]

export const BREAKDOWN_PAGE_SIZES = [10, 20, 50]
