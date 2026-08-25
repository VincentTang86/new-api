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
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useModelDetailsDrawer } from '@/features/pricing/hooks/use-model-details-drawer'

import { LANDING_PRICE_PLACEHOLDER } from '../../lib/pricing'
import type { PricingRow } from '../../types'
import type { PricingListVariant } from './pricing-model-list'
import { ProviderMark } from './provider-mark'
import { SavingsBadge } from './savings-cell'

interface PricingPreviewRowProps {
  row: PricingRow
  variant: PricingListVariant
}

export function PricingPreviewRow(props: PricingPreviewRowProps) {
  const { t } = useTranslation()
  const { openModel } = useModelDetailsDrawer()
  const row = props.row
  const nameRef = useRef<HTMLSpanElement>(null)
  // Whether the name is cut depends on the viewport the column share resolves
  // against, so it is measured when the tooltip would open rather than once on
  // mount: a name that only truncates on a narrow window still gets its
  // tooltip, and a name that fits never opens one repeating what is on screen.
  const [showFullName, setShowFullName] = useState(false)

  // Per-request models bill by call, so the discounted price lives in the input
  // cell as "$X / call" and the output cell has no meaning.
  const frInput = row.isPerRequest
    ? t('{{price}} / call', { price: row.frInput })
    : row.frInput
  const frOutput = row.isPerRequest ? LANDING_PRICE_PLACEHOLDER : row.frOutput

  return (
    // The whole row opens the details drawer, as the design does. The View
    // cell below stays a real button so the same action is reachable by
    // keyboard without inventing row-level key handling.
    <tr
      onClick={() => openModel(row.modelId)}
      className='cursor-pointer border-b border-(--pd-border) transition-colors last:border-b-0 odd:bg-(--pd-surface) even:bg-(--pd-surface-alt) hover:bg-(--pd-accent-bg-hover)'
    >
      <th scope='row' className='px-6 py-4 text-left font-normal'>
        <div className='flex items-center gap-2.5'>
          <ProviderMark
            provider={row.provider}
            label={row.vendorLabel}
            variant={props.variant === 'preview' ? 'dot' : 'chip'}
          />
          <TooltipProvider delay={0}>
            <Tooltip
              open={showFullName}
              onOpenChange={(open) => {
                const name = nameRef.current
                setShowFullName(
                  open && name !== null && name.scrollWidth > name.clientWidth
                )
              }}
            >
              <TooltipTrigger
                render={
                  <span
                    ref={nameRef}
                    className='truncate font-mono text-sm font-bold text-(--pd-ink-strong)'
                  />
                }
              >
                {row.name}
              </TooltipTrigger>
              <TooltipContent className='font-mono'>{row.name}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </th>
      <td className='px-6 py-4 text-right font-mono text-sm font-bold text-(--pd-ink)'>
        {frInput}
      </td>
      <td className='px-6 py-4 text-right font-mono text-sm font-bold text-(--pd-ink)'>
        {frOutput}
      </td>
      <td className='px-6 py-4 text-right font-mono text-sm text-(--pd-muted)'>
        {row.officialInput}
      </td>
      <td className='px-6 py-4 text-right font-mono text-sm text-(--pd-muted)'>
        {row.officialOutput}
      </td>
      <td className='px-6 py-4 text-right'>
        <SavingsBadge row={row} />
      </td>
      <td className='px-6 py-4 text-right'>
        <button
          type='button'
          onClick={(event) => {
            event.stopPropagation()
            openModel(row.modelId)
          }}
          className='pd-font-ui cursor-pointer text-[13px] font-medium whitespace-nowrap text-(--pd-primary) transition-opacity hover:opacity-80'
        >
          {t('View →')}
        </button>
      </td>
    </tr>
  )
}
