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
import type { UserLogMetrics } from '../types'

const PLACEHOLDER = '-'

// Time to first token is milliseconds and routinely lands under a second.
function formatLatencyMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
}

// Completion time comes from the whole-second use_time column, so a decimal
// only carries information while the value is small.
function formatDurationSeconds(seconds: number): string {
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`
}

export interface CompletionTimeDisplay {
  /** Mean end-to-end duration, `-` when the range holds no consume logs. */
  value: string
  /** Nearest-rank p95 over the same requests the average covers. */
  p95: string
  /** Mean time to first token, null unless streaming requests contributed. */
  ttft: string | null
}

/**
 * The card headline and its p95 both read use_time, which every consume log
 * carries, so they can never disagree about which requests they describe. Time
 * to first token is a different quantity on a different population — only
 * streaming requests record a first packet — so it stays a labelled extra
 * rather than being averaged into the headline.
 */
export function buildCompletionTimeDisplay(
  metrics: UserLogMetrics | undefined
): CompletionTimeDisplay {
  if (!metrics || metrics.consume_count <= 0) {
    return { value: PLACEHOLDER, p95: PLACEHOLDER, ttft: null }
  }
  return {
    value: formatDurationSeconds(metrics.avg_use_time),
    p95: formatDurationSeconds(metrics.p95_use_time),
    ttft: metrics.frt_count > 0 ? formatLatencyMs(metrics.avg_frt_ms) : null,
  }
}
