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

import { LANDING_CONTAINER, LANDING_SECTION_IDS } from '../../constants'
import { useLandingPricingRows } from '../../lib/use-landing-pricing-rows'
import { PricingModelList } from '../pricing/pricing-model-list'

/** How many models the home teaser shows before "View all models". */
const PREVIEW_ROW_LIMIT = 10

export function LandingPricingPreview() {
  const { t } = useTranslation()
  const { rows, isLoading, isError, refetch } = useLandingPricingRows()
  const previewRows = rows.slice(0, PREVIEW_ROW_LIMIT)

  return (
    <section
      id={LANDING_SECTION_IDS.pricing}
      className={cn(LANDING_CONTAINER, 'py-20')}
    >
      <div className='mb-8'>
        <h2 className='mb-3 text-3xl font-semibold tracking-tight text-gray-900 max-[640px]:text-2xl'>
          {t('Models & pricing, made clear')}
        </h2>
        <p className='text-sm text-gray-500'>
          {t('Our discounted prices vs. official rates, USD per 1M tokens')}
        </p>
      </div>

      <PricingModelList
        rows={previewRows}
        variant='preview'
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
      />

      <div className='mt-4 flex flex-wrap items-center justify-between gap-2'>
        <p className='text-xs text-gray-400'>
          {t(
            'Discounted rates shown. Official prices are sourced from each provider’s public pricing page. Savings are calculated against those rates. Your invoice reflects actual usage.'
          )}
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
