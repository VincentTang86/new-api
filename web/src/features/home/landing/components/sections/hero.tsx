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
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { LANDING_CONTAINER } from '../../constants'
import { useLandingModelSummary } from '../../lib/use-landing-model-summary'
import { LandingProviderRow } from './provider-row'

interface LandingHeroProps {
  isAuthenticated: boolean
}

export function LandingHero(props: LandingHeroProps) {
  const { t } = useTranslation()
  const { count } = useLandingModelSummary()

  const primaryLabel = props.isAuthenticated
    ? t('Go to console')
    : t('Create an API key')
  const primaryTarget = props.isAuthenticated ? '/keys' : '/register'

  // Until the catalog answers, the copy drops the number rather than showing a
  // guess that would then flip to a different one.
  const eyebrow =
    count === null
      ? t('Curated models · One OpenAI-compatible API')
      : t('{{modelCount}} curated models · One OpenAI-compatible API', {
          modelCount: count,
        })
  const subhead =
    count === null
      ? t('Call our curated models with one API key, at a lower price.')
      : t(
          'Call {{modelCount}} curated models with one API key, at a lower price.',
          {
            modelCount: count,
          }
        )

  return (
    <section
      className={cn(
        LANDING_CONTAINER,
        'pt-20 pb-16 max-[640px]:pt-12 max-[640px]:pb-10'
      )}
    >
      <div className='max-w-[720px]'>
        <p className='mb-4 font-mono text-sm tracking-wide text-indigo-600'>
          {eyebrow}
        </p>

        <h1 className='mb-4 text-[52px] leading-[1.12] font-semibold tracking-tight text-gray-900 max-[640px]:text-[36px]'>
          {t('Fair prices. Real models.')}
          <br />
          {t('Reliable access.')}
        </h1>

        <p className='mb-2 text-[17px] leading-relaxed text-gray-700 max-[640px]:text-base'>
          {subhead}
        </p>
        <p className='mb-8 text-[17px] leading-relaxed text-gray-500 max-[640px]:text-base'>
          {t(
            'The model ID you request is the model that runs — no swaps, no silent downgrades.'
          )}
        </p>

        <div className='mb-8 flex flex-wrap gap-3'>
          <Link
            to={primaryTarget}
            className='inline-flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700'
          >
            {primaryLabel}
            <ArrowRight size={14} aria-hidden />
          </Link>
          <Link
            to='/pricing'
            className='inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900'
          >
            {t('View models & pricing')}
          </Link>
        </div>

        <p className='font-mono text-xs text-gray-400'>
          {t(
            'Transparent pricing · No subscriptions · Real model routing · Low latency · Pay as you go'
          )}
        </p>
      </div>

      <LandingProviderRow />
    </section>
  )
}
