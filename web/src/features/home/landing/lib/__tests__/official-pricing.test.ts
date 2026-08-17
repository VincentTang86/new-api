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
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

import { parseOfficialPricing } from '../official-pricing'

const SHIPPED_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../public/official-pricing.json'
)

describe('parseOfficialPricing', () => {
  test('keeps the fields the pricing table renders', () => {
    const parsed = parseOfficialPricing({
      updatedAt: '2026-08-04',
      models: {
        'gpt-4o': {
          displayName: 'GPT-4o',
          officialInput: 2.5,
          officialOutput: 10,
          context: '128K',
          unknownField: 'ignored',
        },
        'flux-1.1-pro': { officialRequestPrice: 0.08 },
      },
    })

    expect(parsed['gpt-4o']).toEqual({
      displayName: 'GPT-4o',
      context: '128K',
      officialInput: 2.5,
      officialOutput: 10,
    })
    expect(parsed['flux-1.1-pro']).toEqual({ officialRequestPrice: 0.08 })
  })

  test('drops unusable prices field by field, keeping the rest of the entry', () => {
    const parsed = parseOfficialPricing({
      models: {
        'a-model': {
          displayName: 'A Model',
          officialInput: -1,
          officialOutput: '10',
          officialRequestPrice: Number.NaN,
          context: '128K',
        },
      },
    })

    // A negative / non-numeric / NaN list price would make the savings maths
    // dishonest, so those fields vanish and the columns fall back to a dash.
    expect(parsed['a-model']).toEqual({
      displayName: 'A Model',
      context: '128K',
    })
  })

  test('drops a zero list price rather than claiming a 100% saving', () => {
    const parsed = parseOfficialPricing({
      models: { 'a-model': { officialInput: 0, officialOutput: 10 } },
    })
    expect(parsed['a-model']).toEqual({ officialOutput: 10 })
  })

  test('returns an empty map for a structurally broken file', () => {
    expect(parseOfficialPricing(null)).toEqual({})
    expect(parseOfficialPricing('not json')).toEqual({})
    expect(parseOfficialPricing({})).toEqual({})
    expect(parseOfficialPricing({ models: [] })).toEqual({})
    // A non-object entry is skipped, the valid sibling survives.
    expect(
      parseOfficialPricing({
        models: { bad: 'nope', good: { officialInput: 1 } },
      })
    ).toEqual({ good: { officialInput: 1 } })
  })

  test('the shipped official-pricing.json survives validation intact', () => {
    const raw = JSON.parse(readFileSync(SHIPPED_FILE, 'utf8'))
    const parsed = parseOfficialPricing(raw)

    // Guards against a hand-edit that silently empties the official / savings
    // columns in production.
    expect(
      Object.keys(parsed).length,
      'every model in official-pricing.json must parse'
    ).toBe(Object.keys(raw.models).length)
    for (const [modelName, entry] of Object.entries(parsed)) {
      expect(
        entry.officialInput !== undefined ||
          entry.officialRequestPrice !== undefined,
        `${modelName} carries no usable official price`
      ).toBe(true)
    }
  })
})
