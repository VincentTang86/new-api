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
import type { TFunction } from 'i18next'
import { describe, expect, test } from 'vitest'

import {
  buildServiceTierOptions,
  pickDefaultServiceTier,
} from '../service-tier-options'

// The catalogue stores i18n keys, so an identity `t` keeps the expectations
// readable while still exercising the translated-vs-raw branches.
const t = ((key: string) => key) as unknown as TFunction

describe('buildServiceTierOptions', () => {
  test('puts Production before Best Effort whatever order the backend returned', () => {
    const options = buildServiceTierOptions(
      {
        'Best Effort': { desc: 'Lower Cost', ratio: 0.9 },
        Production: { desc: 'Production', ratio: 1 },
      },
      t
    )

    expect(options.map((option) => option.value)).toEqual([
      'Production',
      'Best Effort',
    ])
  })

  test('names a known tier from the catalogue instead of its admin-managed description', () => {
    const options = buildServiceTierOptions(
      { Production: { desc: '默认分组', ratio: 1 } },
      t
    )

    expect(options[0]).toEqual({
      value: 'Production',
      label: 'Production',
      description: 'Higher-reliability endpoints for production workloads.',
      pricingLabel: 'Regular pricing',
      ratio: 1,
    })
  })

  test('matches a known tier written with other separators or casing', () => {
    const options = buildServiceTierOptions(
      { best_effort: { desc: '', ratio: 0.5 } },
      t
    )

    expect(options[0]?.label).toBe('Best Effort')
    expect(options[0]?.pricingLabel).toBe('Discounted pricing')
  })

  test('keeps an unrecognised group raw, with its description and no pricing badge', () => {
    const options = buildServiceTierOptions(
      { vip: { desc: 'Priority access', ratio: 2 } },
      t
    )

    expect(options[0]).toEqual({
      value: 'vip',
      label: 'vip',
      description: 'Priority access',
      pricingLabel: undefined,
      ratio: 2,
    })
  })

  test('drops an unrecognised description that only repeats the group name', () => {
    const options = buildServiceTierOptions({ vip: { desc: 'vip' } }, t)

    expect(options[0]?.description).toBeUndefined()
  })

  test('returns no tiers when the groups are still unloaded', () => {
    expect(buildServiceTierOptions(undefined, t)).toEqual([])
  })
})

describe('pickDefaultServiceTier', () => {
  const tiers = buildServiceTierOptions(
    {
      vip: { desc: 'Priority access', ratio: 2 },
      'Best Effort': { desc: 'Lower Cost', ratio: 0.9 },
      Production: { desc: 'Production', ratio: 1 },
      auto: { desc: 'Automatic routing', ratio: 'auto' },
    },
    t
  )

  test('opens on Production when the deployment does not default to Auto', () => {
    expect(pickDefaultServiceTier(tiers, false)).toBe('Production')
  })

  test('opens on Auto when the deployment defaults to it', () => {
    expect(pickDefaultServiceTier(tiers, true)).toBe('auto')
  })

  test('falls back to Production when Auto is preferred but not usable', () => {
    const withoutAuto = tiers.filter((tier) => tier.value !== 'auto')

    expect(pickDefaultServiceTier(withoutAuto, true)).toBe('Production')
  })

  test('falls back to the default group when no known tier is configured', () => {
    const ownGroups = buildServiceTierOptions(
      { vip: { ratio: 2 }, default: { ratio: 1 } },
      t
    )

    expect(pickDefaultServiceTier(ownGroups, false)).toBe('default')
  })

  test('falls back to the first group when neither a known tier nor default exists', () => {
    const ownGroups = buildServiceTierOptions(
      { vip: { ratio: 2 }, svip: { ratio: 3 } },
      t
    )

    expect(pickDefaultServiceTier(ownGroups, false)).toBe('vip')
  })

  test('returns an empty tier when no group is usable', () => {
    expect(pickDefaultServiceTier([], false)).toBe('')
  })
})
