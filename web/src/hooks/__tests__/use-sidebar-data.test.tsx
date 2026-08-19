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
import { renderHook } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import type { NavItem } from '@/components/layout/types'
import { ROLE } from '@/lib/roles'

import { useSidebarData } from '../use-sidebar-data'

function navGroups() {
  return renderHook(() => useSidebarData()).result.current.navGroups
}

function itemsOf(groupId: string): NavItem[] {
  return navGroups().find((group) => group.id === groupId)?.items ?? []
}

describe('useSidebarData', () => {
  test('exposes the member groups from the design, then administration', () => {
    expect(navGroups().map((group) => group.id)).toEqual([
      'chat',
      'general',
      'personal',
      'admin',
    ])
  })

  test('member routes match the designed console entries', () => {
    const urls = ['chat', 'general', 'personal'].flatMap((groupId) =>
      itemsOf(groupId).map((item) => ('url' in item ? item.url : null))
    )

    expect(urls).toEqual([
      '/playground',
      '/dashboard',
      '/keys',
      '/usage-logs/common',
      '/usage-logs/task',
      '/wallet',
      '/profile',
    ])
  })

  test('drops the chat presets entry the design does not have', () => {
    const items = navGroups().flatMap((group) => group.items)

    expect(items.some((item) => 'type' in item && item.type)).toBe(false)
  })

  test('async tasks still covers the drawing logs route', () => {
    // Both log surfaces share one entry, so the site-wide config has to see
    // either of them as a reason to keep it visible.
    const asyncTasks = itemsOf('general').find(
      (item) => 'url' in item && item.url === '/usage-logs/task'
    )

    expect(asyncTasks?.configUrls).toEqual([
      '/usage-logs/drawing',
      '/usage-logs/task',
    ])
    expect(asyncTasks?.activeUrls).toEqual(['/usage-logs/drawing'])
  })

  test('administration entries declare what the account must have', () => {
    // useSidebarView applies these; here we only pin the declarations, since
    // getting one wrong silently exposes or hides an entry.
    const gates = itemsOf('admin').map((item) => [
      'url' in item ? item.url : null,
      item.requiredRole,
      item.requiredCapability,
    ])

    expect(gates).toEqual([
      ['/channels', undefined, { resource: 'channel', action: 'read' }],
      ['/models/metadata', undefined, undefined],
      ['/users', undefined, undefined],
      ['/usage-analytics/flow', undefined, undefined],
      ['/redemption-codes', undefined, undefined],
      ['/subscriptions', undefined, undefined],
      ['/system-info', ROLE.SUPER_ADMIN, undefined],
      ['/system-settings/site', ROLE.SUPER_ADMIN, undefined],
    ])
  })
})
