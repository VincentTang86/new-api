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
import type { TimeRange } from '@/lib/time-range'

import type { UsageGranularity } from '../types'

// Spans longer than this default to daily buckets in the trend chart.
const DAILY_GRANULARITY_THRESHOLD_DAYS = 2

export function defaultGranularityForRange(range: TimeRange): UsageGranularity {
  const spanDays = (range.end - range.start) / 86400
  return spanDays > DAILY_GRANULARITY_THRESHOLD_DAYS ? 'day' : 'hour'
}
