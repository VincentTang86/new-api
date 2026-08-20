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
import { describe, expect, test } from 'vitest'

import {
  ADMIN_DASHBOARD_DEFAULT_SECTION,
  ADMIN_DASHBOARD_SECTION_IDS,
  isAdminDashboardSectionId,
} from '../section-registry'

// The section ids are URL segments: the sidebar entry, the $section route
// guard, and the /usage-analytics redirects all depend on this exact set.
describe('admin dashboard section registry', () => {
  test('exposes the four restored dashboard sections in tab order', () => {
    expect([...ADMIN_DASHBOARD_SECTION_IDS]).toEqual([
      'overview',
      'models',
      'flow',
      'users',
    ])
  })

  test('opens on the overview section by default', () => {
    expect(ADMIN_DASHBOARD_DEFAULT_SECTION).toBe('overview')
  })

  test('rejects an unknown URL segment so the route falls back', () => {
    expect(isAdminDashboardSectionId('models')).toBe(true)
    expect(isAdminDashboardSectionId('settings')).toBe(false)
  })
})
