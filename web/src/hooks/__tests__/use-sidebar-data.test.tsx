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

import { useSidebarData } from '../use-sidebar-data'

function navGroups() {
  return renderHook(() => useSidebarData()).result.current.navGroups
}

describe('useSidebarData', () => {
  test('exposes the three designed groups in order', () => {
    expect(navGroups().map((group) => group.id)).toEqual([
      'chat',
      'general',
      'personal',
    ])
  })

  test('routes match the designed console entries', () => {
    const urls = navGroups().flatMap((group) =>
      group.items.map((item) => ('url' in item ? item.url : null))
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

  test('carries no administration entries', () => {
    // Administration lives on the legacy console; the routes stay reachable by
    // URL behind their own role guards, but nothing links to them from here.
    const groups = navGroups()

    expect(groups.some((group) => group.id === 'admin')).toBe(false)
    expect(
      groups
        .flatMap((group) => group.items)
        .some((item) => 'url' in item && String(item.url).startsWith('/system'))
    ).toBe(false)
  })

  test('drops the chat presets entry the design does not have', () => {
    const items = navGroups().flatMap((group) => group.items)

    expect(items.some((item) => 'type' in item && item.type)).toBe(false)
  })

  test('async tasks still covers the drawing logs route', () => {
    // Both log surfaces share one entry, so the site-wide config has to see
    // either of them as a reason to keep it visible.
    const asyncTasks = navGroups()
      .flatMap((group) => group.items)
      .find((item) => 'url' in item && item.url === '/usage-logs/task')

    expect(asyncTasks?.configUrls).toEqual([
      '/usage-logs/drawing',
      '/usage-logs/task',
    ])
    expect(asyncTasks?.activeUrls).toEqual(['/usage-logs/drawing'])
  })
})
