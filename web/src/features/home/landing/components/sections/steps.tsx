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
      <h2 className='pd-font-display mb-12 text-[40px] font-extrabold tracking-tight text-(--pd-ink-strong) max-[640px]:text-[28px]'>
        {t('Get started in three steps')}
      </h2>
      <ol className='grid grid-cols-3 gap-8 max-[640px]:grid-cols-1'>
        {steps.map((step, index) => (
          <li key={step.key} className='flex flex-col'>
            <span
              aria-hidden
              className='mb-4 flex size-8 items-center justify-center rounded-lg bg-(--pd-accent-bg) font-mono text-sm font-bold text-(--pd-primary)'
            >
              {index + 1}
            </span>
            <h3 className='pd-font-display mb-2 text-xl font-bold text-(--pd-ink-strong)'>
              {step.title}
            </h3>
            <p className='text-base leading-[1.6] text-(--pd-muted)'>
              {step.desc}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
