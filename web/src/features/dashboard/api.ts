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
import { getApiKeys } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import { api } from '@/lib/api'

import type { FlowQuotaDataItem, QuotaDataItem, UserLogMetrics } from './types'

interface RangeParams {
  start_timestamp: number
  end_timestamp: number
}

// Hourly usage buckets for the signed-in user (feeds KPI cards + trend chart)
export async function getSelfQuotaDates(params: RangeParams) {
  const res = await api.get<{
    success: boolean
    data?: QuotaDataItem[]
    message?: string
  }>('/api/data/self', { params })
  return res.data
}

// token × group × model aggregation for the signed-in user (feeds breakdown table)
export async function getSelfFlowQuotaDates(params: RangeParams) {
  const res = await api.get<{
    success: boolean
    data?: FlowQuotaDataItem[]
    message?: string
  }>('/api/data/flow/self', { params })
  return res.data
}

// Consume/error log aggregation (success rate, avg latency, in/out tokens)
export async function getSelfLogMetrics(params: RangeParams) {
  const res = await api.get<{
    success: boolean
    data?: UserLogMetrics
    message?: string
  }>('/api/log/self/metrics', { params })
  return res.data
}

const TOKEN_PAGE_SIZE = 100
const TOKEN_MAX_PAGES = 50

// Fetch the full API-key list (key count / status split / accessed_time join)
export async function getAllApiKeys(): Promise<ApiKey[]> {
  const keys: ApiKey[] = []
  for (let page = 1; page <= TOKEN_MAX_PAGES; page++) {
    const res = await getApiKeys({ p: page, size: TOKEN_PAGE_SIZE })
    const data = res?.data
    if (!res?.success || !data?.items?.length) break
    keys.push(...data.items)
    if (keys.length >= data.total) break
  }
  return keys
}
