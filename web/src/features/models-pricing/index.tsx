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

import { PublicLayout } from '@/components/layout'
import { PricingModelList } from '@/features/home/landing/components/pricing/pricing-model-list'
import { LANDING_CONTAINER } from '@/features/home/landing/constants'
import { useLandingPricingRows } from '@/features/home/landing/lib/use-landing-pricing-rows'

export function ModelsPricing() {
  const { t } = useTranslation()
  const { rows, isLoading, isError, refetch } = useLandingPricingRows()

  return (
    <PublicLayout showMainContainer={false}>
      {/* 56px is the sticky header, so a short catalogue still fills the fold. */}
      <main id='main' className='min-h-[calc(100vh-56px)]'>
        <div className='border-b border-gray-200 bg-white'>
          <div className={`${LANDING_CONTAINER} py-12`}>
            <h1 className='mb-4 text-[36px] font-semibold tracking-tight text-gray-900 max-[640px]:text-2xl'>
              {t('Models & Pricing')}
            </h1>
            <p className='text-sm text-gray-500'>
              {t('Our discounted prices vs. official rates, USD per 1M tokens')}
            </p>
          </div>
        </div>

        <div className={`${LANDING_CONTAINER} py-10`}>
          <PricingModelList
            rows={rows}
            variant='catalogue'
            isLoading={isLoading}
            isError={isError}
            onRetry={refetch}
          />

          <p className='mt-6 text-xs leading-relaxed text-gray-400'>
            {t(
              'Discounted rates shown. Official prices are sourced from each provider’s public pricing page. Savings are calculated against those rates. Your invoice reflects actual usage.'
            )}
          </p>
        </div>
      </main>
    </PublicLayout>
  )
}
