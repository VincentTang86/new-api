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

// Hourly pre-aggregated usage buckets from /api/data/self
export interface QuotaDataItem {
  id?: number
  user_id?: number
  username?: string
  model_name?: string
  created_at: number
  token_used?: number
  count?: number
  quota?: number
}

// token_id × use_group × model_name aggregation from /api/data/flow/self
export interface FlowQuotaDataItem {
  user_id?: number
  username?: string
  node_name?: string
  use_group?: string
  token_id?: number
  token_name?: string
  is_playground?: boolean
  last_used_time?: number
  channel_id?: number
  channel_name?: string
  model_name?: string
  token_used?: number
  count?: number
  quota?: number
}

// Aggregated consume/error log metrics from /api/log/self/metrics
export interface UserLogMetrics {
  prompt_tokens: number
  completion_tokens: number
  quota: number // consume logs only
  consume_count: number
  error_count: number
  avg_use_time: number // seconds, consume logs only
}

export type DashboardRangeKey =
  | 'today'
  | 'yesterday'
  | '7days'
  | '30days'
  | 'custom'

// Resolved time range in unix seconds
export interface DashboardRange {
  key: DashboardRangeKey
  start: number
  end: number
}

export type UsageMetric = 'tokens' | 'cost' | 'requests'

export type UsageGranularity = 'hour' | 'day'

export type BreakdownTab = 'model' | 'apikey'
