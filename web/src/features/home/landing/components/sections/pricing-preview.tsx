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
import { ArrowRight, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { LANDING_CONTAINER, LANDING_SECTION_IDS } from '../../constants'
import { LANDING_PRICING_TABLE } from '../../data/models'
import { formatPricingUpdatedAt } from '../../lib/pricing'
import { PricingModelList } from '../pricing/pricing-model-list'

export function LandingPricingPreview() {
  const { t, i18n } = useTranslation()
  const updatedAt = formatPricingUpdatedAt(
    LANDING_PRICING_TABLE.updatedAt,
    i18n.language
  )

  return (
    <section
      id={LANDING_SECTION_IDS.pricing}
      className={cn(LANDING_CONTAINER, 'py-20')}
    >
      <div className='mb-8'>
        <h2 className='mb-3 text-3xl font-semibold tracking-tight text-gray-900 max-[640px]:text-2xl'>
          {t('{{count}} models, clear pricing', {
            count: LANDING_PRICING_TABLE.rows.length,
          })}
        </h2>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <p className='text-sm text-gray-500'>
            {t('Our discounted prices vs. official rates, USD per 1M tokens')}
          </p>
          <p className='flex items-center gap-1 font-mono text-xs text-gray-400'>
            <Clock size={11} aria-hidden />
            {t('Updated {{date}}', { date: updatedAt })}
          </p>
        </div>
      </div>

      <PricingModelList rows={LANDING_PRICING_TABLE.rows} variant='preview' />

      <div className='mt-4 flex flex-wrap items-center justify-between gap-2'>
        <p className='text-xs text-gray-400'>
          {t(
            'Discounted rates shown. Official prices are sourced from each provider’s public pricing page. Savings are calculated against those rates. Your invoice reflects actual usage.'
          )}{' '}
          <a
            href={LANDING_PRICING_TABLE.source.href}
            target='_blank'
            rel='noopener noreferrer'
            className='underline underline-offset-2 hover:text-gray-600'
          >
            {LANDING_PRICING_TABLE.source.label}
          </a>
        </p>
        <Link
          to='/pricing'
          className='flex items-center gap-1 text-xs whitespace-nowrap text-indigo-600 transition-colors hover:text-indigo-800'
        >
          {t('View all models')}
          <ArrowRight size={11} aria-hidden />
        </Link>
      </div>
    </section>
  )
}
