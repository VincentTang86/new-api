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
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { LANDING_CONTAINER } from '../../constants'

export function LandingSteps() {
  const { t } = useTranslation()

  const steps = [
    {
      key: 'topup',
      title: t('Register & top up'),
      desc: t(
        'Create an account and add credit. No minimum spend, no monthly fee.'
      ),
    },
    {
      key: 'key',
      title: t('Create API Key'),
      desc: t('Generate a key for your project from the dashboard.'),
    },
    {
      key: 'integrate',
      title: t('Integrate'),
      desc: t(
        'Replace base_url and the model ID. Your existing code works as-is.'
      ),
    },
  ]

  return (
    <section className={cn(LANDING_CONTAINER, 'py-16')}>
      <h2 className='pd-font-display mb-12 text-[40px] font-extrabold text-(--pd-ink-strong) max-[640px]:text-[28px]'>
        {t('Get started in three steps')}
      </h2>
      <ol className='grid grid-cols-3 gap-8 max-[640px]:grid-cols-1'>
        {steps.map((step, index) => (
          <li
            key={step.key}
            className='flex flex-col gap-5 rounded-2xl border-t-2 border-(--pd-border) bg-(--pd-surface) p-10 drop-shadow-[0px_10px_12px_rgba(0,0,0,0.04)] max-[640px]:p-7'
          >
            <span
              aria-hidden
              className='pd-font-display bg-linear-to-r from-(--pd-gradient-from) to-(--pd-gradient-to) bg-clip-text text-[48px] leading-none font-extrabold text-transparent'
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className='pd-font-display text-xl font-extrabold text-(--pd-ink)'>
              {step.title}
            </h3>
            <p className='text-[15px] leading-[1.6] text-(--pd-muted)'>
              {step.desc}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
