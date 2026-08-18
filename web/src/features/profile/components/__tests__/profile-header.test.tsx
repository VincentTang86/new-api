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
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { ROLE } from '@/lib/roles'

import type { UserProfile } from '../../types'
import { ProfileHeader } from '../profile-header'

function profileWithRole(role: number): UserProfile {
  return {
    id: 4,
    username: 'fair',
    display_name: 'fair',
    role,
    group: 'default',
    quota: 0,
    used_quota: 0,
    request_count: 0,
    status: 1,
    aff_count: 0,
    aff_quota: 0,
    aff_history_quota: 0,
    created_time: 0,
  }
}

function renderFor(role: number) {
  render(<ProfileHeader profile={profileWithRole(role)} loading={false} />)
}

describe('ProfileHeader identity row', () => {
  test('hides the account tier and group from an ordinary user', () => {
    renderFor(ROLE.USER)

    expect(screen.queryByText('User')).not.toBeInTheDocument()
    expect(screen.queryByText('default')).not.toBeInTheDocument()
    // The user's own id stays — it is what support asks them for.
    expect(screen.getByText('User ID 4')).toBeInTheDocument()
  })

  test('shows both to an admin', () => {
    renderFor(ROLE.ADMIN)

    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('default')).toBeInTheDocument()
  })

  test('shows both to a super admin', () => {
    renderFor(ROLE.SUPER_ADMIN)

    expect(screen.getByText('Super Admin')).toBeInTheDocument()
    expect(screen.getByText('default')).toBeInTheDocument()
  })
})
