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
import { describe, expect, it } from 'vitest'

import type { UserLogMetrics } from '../../types'
import { buildCompletionTimeDisplay } from '../completion-time'

function metrics(overrides: Partial<UserLogMetrics> = {}): UserLogMetrics {
  return {
    prompt_tokens: 0,
    completion_tokens: 0,
    quota: 0,
    consume_count: 0,
    error_count: 0,
    avg_use_time: 0,
    p95_use_time: 0,
    frt_count: 0,
    avg_frt_ms: 0,
    p95_frt_ms: 0,
    ...overrides,
  }
}

describe('buildCompletionTimeDisplay', () => {
  // The card used to hide its p95 whenever no request recorded a first packet,
  // so a day of non-streaming traffic showed a headline next to a bare "-".
  // Both numbers now read use_time, which every consume log carries.
  it('reports a p95 for a range without any streaming request', () => {
    const display = buildCompletionTimeDisplay(
      metrics({ consume_count: 6, avg_use_time: 1.67, p95_use_time: 3 })
    )
    expect(display).toEqual({ value: '1.7s', p95: '3.0s', ttft: null })
  })

  it('adds time to first token once streaming rows contribute', () => {
    const display = buildCompletionTimeDisplay(
      metrics({
        consume_count: 96,
        avg_use_time: 14.63,
        p95_use_time: 58,
        frt_count: 80,
        avg_frt_ms: 3128,
        p95_frt_ms: 5203,
      })
    )
    expect(display).toEqual({ value: '15s', p95: '58s', ttft: '3.1s' })
  })

  it('keeps sub-second first tokens in milliseconds', () => {
    const display = buildCompletionTimeDisplay(
      metrics({
        consume_count: 4,
        avg_use_time: 1.5,
        p95_use_time: 5,
        frt_count: 4,
        avg_frt_ms: 420,
      })
    )
    expect(display.ttft).toBe('420ms')
  })

  it('placeholds every figure when the range holds no requests', () => {
    expect(buildCompletionTimeDisplay(metrics())).toEqual({
      value: '-',
      p95: '-',
      ttft: null,
    })
    expect(buildCompletionTimeDisplay(undefined)).toEqual({
      value: '-',
      p95: '-',
      ttft: null,
    })
  })
})
