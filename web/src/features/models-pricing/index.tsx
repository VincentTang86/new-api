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
import { PricingTableControls } from '@/features/home/landing/components/pricing/pricing-table-controls'
import { LANDING_CONTAINER } from '@/features/home/landing/constants'
import { useLandingPricingRows } from '@/features/home/landing/lib/use-landing-pricing-rows'
import { useSystemConfig } from '@/hooks/use-system-config'

export function ModelsPricing() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const table = useLandingPricingRows()

  return (
    <PublicLayout showMainContainer={false}>
      {/* 55px is the sticky header, so a short catalogue still fills the fold. */}
      <main id='main' className='min-h-[calc(100vh-55px)]'>
        <div className={`${LANDING_CONTAINER} pt-12 pb-6`}>
          <h1 className='pd-font-display mb-4 text-[40px] font-extrabold tracking-tight text-(--pd-ink-strong) max-[640px]:text-[28px]'>
            {t('Models & pricing, made clear')}
          </h1>
          <p className='text-base text-(--pd-muted)'>
            {t(
              'Compare {{name}} rates with the selected benchmark. Prices are shown in USD per million tokens.',
              { name: systemName }
            )}
          </p>
        </div>

        <div className={`${LANDING_CONTAINER} pb-16`}>
          <PricingTableControls
            groups={table.groups}
            selectedGroup={table.selectedGroup}
            onGroupChange={table.setSelectedGroup}
            benchmark={table.benchmark}
            onBenchmarkChange={table.setBenchmark}
            providers={table.providers}
            providerFilter={table.providerFilter}
            onProviderChange={table.setProviderFilter}
          />

          <PricingModelList
            rows={table.rows}
            variant='catalogue'
            benchmark={table.benchmark}
            isLoading={table.isLoading}
            isError={table.isError}
            onRetry={table.refetch}
          />

          <p className='mt-6 text-[13px] leading-relaxed text-(--pd-muted-3)'>
            {t(
              "Comparison rates come from the selected source's public model listings. Savings are calculated against that rate."
            )}
          </p>
        </div>
      </main>
    </PublicLayout>
  )
}
