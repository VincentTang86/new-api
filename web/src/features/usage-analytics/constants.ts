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
import type { TimeGranularity } from '@/lib/time'

import type { FlowMetric, FlowOverflowMode } from './types'

/*
 * /api/data/flow and /api/data/users enforce no window limit server-side
 * (controller/usedata.go validates only that the timestamps parse and that
 * end >= start), so this constant is the only gate in the whole stack.
 *
 * A quarter is three times the self endpoints' 30 days, which is what makes a
 * separate admin view worth having. The binding cost is /api/data/users: it
 * groups by username and created_at, i.e. one row per active user per hour,
 * so its payload grows linearly with the window. The flow endpoint does not
 * group by time at all, so its row count saturates instead.
 */
export const USAGE_ANALYTICS_MAX_RANGE_DAYS = 90

export const FLOW_METRIC_OPTIONS: { value: FlowMetric; labelKey: string }[] = [
  { value: 'quota', labelKey: 'By quota' },
  { value: 'tokens', labelKey: 'By tokens' },
  { value: 'requests', labelKey: 'By requests' },
]

export const FLOW_TOP_LIMIT_OPTIONS = [10, 20, 50, 100]

export const FLOW_OVERFLOW_MODE_OPTIONS: {
  value: FlowOverflowMode
  labelKey: string
}[] = [
  { value: 'aggregate', labelKey: 'Merge into Other' },
  { value: 'hide', labelKey: 'Hide' },
]

export const TOP_USER_LIMIT_OPTIONS = [5, 10, 20, 50]

// The bare Hour/Day/Week keys are noun forms: zh renders 'Week' as 「本周」
// ("this week"), which reads as a date range rather than a bucket size. These
// three are the adverbial set the console dashboard already uses.
export const USER_TIME_GRANULARITY_OPTIONS: {
  value: TimeGranularity
  labelKey: string
}[] = [
  { value: 'hour', labelKey: 'Hourly' },
  { value: 'day', labelKey: 'Daily (time granularity)' },
  { value: 'week', labelKey: 'Weekly' },
]
