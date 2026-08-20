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
import { api } from '@/lib/api'

import type {
  FlowQuotaDataItem,
  QuotaDataItem,
  UptimeGroupResult,
} from './types'

interface RangeParams {
  start_timestamp: number
  end_timestamp: number
}

// All-site quota rows for the model analytics section; `username` narrows the
// data to one user so an admin can inspect the site from that user's angle.
export async function getAllQuotaData(
  params: RangeParams & { username?: string }
) {
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    '/api/data',
    { params }
  )
  return res.data
}

// The overview summary cards chart the admin's own account, same as the
// original dashboard did, so they stay on the self endpoint.
export async function getSelfQuotaData(
  params: RangeParams & { default_time?: string }
) {
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    '/api/data/self',
    { params }
  )
  return res.data
}

export async function getUptimeStatus() {
  const res = await api.get<{ success: boolean; data: UptimeGroupResult[] }>(
    '/api/uptime/status'
  )
  return res.data
}

/**
 * The admin endpoint returns every user's rows and reports the stage columns
 * the caller's role is allowed to see; the self endpoint is the fallback for a
 * session that lost its admin role mid-flight.
 */
export async function getFlowQuotaDates(
  params: RangeParams & { username?: string },
  isAdmin = false
) {
  const endpoint = isAdmin ? '/api/data/flow' : '/api/data/flow/self'
  const res = await api.get<{
    success: boolean
    data?: FlowQuotaDataItem[]
    message?: string
  }>(endpoint, { params })
  return res.data
}

export async function getUserQuotaDataByUsers(params: RangeParams) {
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    '/api/data/users',
    { params }
  )
  return res.data
}
