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

import { ModelDetailsDrawerHost } from '@/features/pricing/components/model-details-drawer-host'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

import { LANDING_CONTAINER, LANDING_SECTION_IDS } from '../../constants'
import { useLandingPricingRows } from '../../lib/use-landing-pricing-rows'
import { PricingModelList } from '../pricing/pricing-model-list'
import { PricingTableControls } from '../pricing/pricing-table-controls'

/** How many models the home teaser shows before "View all models". */
const PREVIEW_ROW_LIMIT = 10

export function LandingPricingPreview() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const table = useLandingPricingRows()
  const previewRows = table.rows.slice(0, PREVIEW_ROW_LIMIT)

  return (
    <section
      id={LANDING_SECTION_IDS.pricing}
      className={cn(LANDING_CONTAINER, 'py-16')}
    >
      <div className='mb-6'>
        <h2 className='pd-font-display mb-3 text-[40px] font-extrabold text-(--pd-ink-strong) max-[640px]:text-[28px]'>
          {t('Models & pricing, made clear')}
        </h2>
        <p className='text-base text-(--pd-muted)'>
          {t(
            'Compare {{name}} rates with the selected benchmark. Prices are shown in USD per million tokens.',
            { name: systemName }
          )}
        </p>
      </div>

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

      <ModelDetailsDrawerHost />

      <PricingModelList
        rows={previewRows}
        variant='preview'
        benchmark={table.benchmark}
        isLoading={table.isLoading}
        isError={table.isError}
        onRetry={table.refetch}
      />

      <div className='mt-4 flex flex-wrap items-center justify-between gap-2'>
        <p className='text-[13px] text-(--pd-muted-3)'>
          {t(
            "Comparison rates come from the selected source's public model listings. Savings are calculated against that rate."
          )}
        </p>
        <Link
          to='/pricing'
          className='pd-font-display flex items-center gap-1 text-base font-bold whitespace-nowrap text-(--pd-primary) underline transition-opacity hover:opacity-80'
        >
          {t('View all models')}
          <ArrowRight size={12} aria-hidden />
        </Link>
      </div>
    </section>
  )
}
