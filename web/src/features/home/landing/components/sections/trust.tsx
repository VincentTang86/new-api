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
import { CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LANDING_CONTAINER } from '../../constants'

export function LandingTrust() {
  const { t } = useTranslation()

  const capabilities = [
    t('Balance & spending history'),
    t('Token usage breakdown'),
    t('Actual model routing records'),
    t('Service health status'),
    // The design asked for "P50 / P95 latency data", but perf_metrics stores
    // summed latency only (pkg/perf_metrics/types.go exposes AvgLatencyMs and
    // success_rate, no percentiles). Claim what the dashboard can show.
    t('Latency and success-rate metrics'),
    t('Per-model billing'),
  ]

  return (
    <section className='border-t border-gray-100 bg-gray-50 py-20'>
      <div className={LANDING_CONTAINER}>
        <div className='max-w-[640px]'>
          <h2 className='mb-3 text-3xl font-semibold tracking-tight text-gray-900 max-[640px]:text-2xl'>
            {t('Every call, fully accountable')}
          </h2>
          <p className='mb-8 text-sm text-gray-500'>
            {t(
              'The dashboard gives you real usage data — not just a balance number.'
            )}
          </p>
          <ul className='grid grid-cols-2 gap-3 max-[640px]:grid-cols-1'>
            {capabilities.map((capability) => (
              <li
                key={capability}
                className='flex items-center gap-2.5 text-sm text-gray-700'
              >
                <CheckCircle
                  size={15}
                  className='shrink-0 text-indigo-600'
                  aria-hidden
                />
                {capability}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
