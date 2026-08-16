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
import { Check } from 'lucide-react'
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

  const primaryTarget = props.isAuthenticated ? '/keys' : '/register'

  // Until the catalog answers, the copy drops the number rather than showing a
  // guess that would then flip to a different one.
  const badge =
    count === null
      ? t('Curated Models · One OpenAI-Compatible API')
      : t('{{modelCount}} Curated Models · One OpenAI-Compatible API', {
          modelCount: count,
        })
  const subhead =
    count === null
      ? t(
          'Access curated AI models with one API key at lower prices. The model you request is the model you get. No hidden substitutions or downgrades.'
        )
      : t(
          'Access {{modelCount}} curated AI models with one API key at lower prices. The model you request is the model you get. No hidden substitutions or downgrades.',
          { modelCount: count }
        )

  const promises = [
    t('Transparent pricing'),
    t('No fees when adding credits'),
    t('Low latency'),
    t('Pay as you go'),
  ]

  return (
    <section className='pd-hero-glow relative overflow-clip'>
      <div
        className={cn(
          LANDING_CONTAINER,
          'relative flex flex-col items-center gap-12 py-16 max-[640px]:gap-8 max-[640px]:py-10'
        )}
      >
        <div className='flex w-full flex-col items-center gap-6 text-center'>
          <div className='flex items-center gap-2 rounded-full border border-(--pd-primary) bg-(--pd-surface) px-4 py-1.5 drop-shadow-[0px_6px_8px_rgba(0,0,0,0.04)]'>
            <span
              aria-hidden='true'
              className='size-2 shrink-0 rounded-full bg-(--pd-ink)'
            />
            <p className='text-[13px] font-semibold text-(--pd-ink)'>{badge}</p>
          </div>

          <h1 className='pd-font-display max-w-[1120px] bg-linear-to-r from-(--pd-gradient-from) to-(--pd-gradient-to) bg-clip-text pb-1 text-[52px] leading-[1.15] font-bold text-transparent max-[640px]:text-[34px]'>
            {t('Fair Pricing. Real Models. Reliable Access.')}
          </h1>

          <p className='max-w-[720px] text-xl leading-[1.6] text-(--pd-muted) max-[640px]:text-base'>
            {subhead}
          </p>
        </div>

        <div className='flex flex-wrap items-center justify-center gap-4'>
          <Link
            to={primaryTarget}
            className='flex items-center justify-center rounded-xl bg-(--pd-primary) px-7 py-3.5 text-sm font-semibold text-white drop-shadow-[0px_10px_12px_rgba(0,0,0,0.07)] transition-opacity hover:opacity-90'
          >
            {t('Get Your API Key')}
          </Link>
          <Link
            to='/pricing'
            className='flex items-center justify-center rounded-xl border border-(--pd-border) bg-(--pd-surface) px-7 py-3.5 text-sm font-semibold text-(--pd-ink) drop-shadow-[0px_6px_8px_rgba(0,0,0,0.04)] transition-colors hover:border-(--pd-primary)'
          >
            {t('View Models & Pricing')}
          </Link>
        </div>

        <ul className='flex flex-wrap items-center justify-center gap-x-6 gap-y-3'>
          {promises.map((promise) => (
            <li key={promise} className='flex items-center gap-2'>
              <Check
                size={16}
                strokeWidth={2}
                className='shrink-0 text-(--pd-ink)'
                aria-hidden
              />
              <span className='text-sm font-medium whitespace-nowrap text-(--pd-ink)'>
                {promise}
              </span>
            </li>
          ))}
        </ul>

        <LandingProviderRow />
      </div>
    </section>
  )
}
