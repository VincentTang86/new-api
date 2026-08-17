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
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LANDING_CONTAINER } from '../../constants'

export function LandingTrust() {
  const { t } = useTranslation()

  const capabilities = [
    t('Balance & spending history'),
    t('Token usage breakdown'),
    t('Actual model routing records'),
    t('Latency and performance stats'),
    t('Recent request details'),
    t('Per model billing'),
  ]

  return (
    <section className={`${LANDING_CONTAINER} py-16`}>
      <div className='max-w-[720px]'>
        <h2 className='pd-font-display mb-3 text-[40px] font-extrabold text-(--pd-ink-strong) max-[640px]:text-[28px]'>
          {t('Every call, fully accountable')}
        </h2>
        <p className='mb-8 text-base text-(--pd-muted)'>
          {t(
            'The dashboard gives you real usage data — not just a balance number.'
          )}
        </p>
        <ul className='grid grid-cols-2 gap-3 max-[640px]:grid-cols-1'>
          {capabilities.map((capability) => (
            <li
              key={capability}
              className='pd-font-ui flex items-center gap-3 rounded-xl border border-(--pd-border) bg-(--pd-surface) p-4 text-[15px] font-semibold text-(--pd-ink) drop-shadow-[0px_6px_8px_rgba(0,0,0,0.04)]'
            >
              <span className='flex size-6 shrink-0 items-center justify-center rounded-xl bg-(--pd-accent-bg)'>
                <Check
                  size={14}
                  strokeWidth={2.5}
                  className='text-(--pd-primary)'
                  aria-hidden
                />
              </span>
              {capability}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
