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
      title: t('Create an API key'),
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
    <section className={cn(LANDING_CONTAINER, 'py-20')}>
      <h2 className='mb-12 text-3xl font-semibold tracking-tight text-gray-900 max-[640px]:text-2xl'>
        {t('Get started in three steps')}
      </h2>
      <ol className='grid grid-cols-3 gap-8 max-[640px]:grid-cols-1'>
        {steps.map((step, index) => (
          <li key={step.key} className='flex flex-col'>
            <span
              aria-hidden
              className='mb-4 font-mono text-4xl font-semibold text-gray-100'
            >
              0{index + 1}
            </span>
            <h3 className='mb-2 text-base font-semibold text-gray-900'>
              {step.title}
            </h3>
            <p className='text-sm leading-relaxed text-gray-600'>{step.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
