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
import { CircleCheck } from 'lucide-react'
import { useId, type ComponentProps } from 'react'

import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useMediaQuery } from '@/hooks'
import { cn } from '@/lib/utils'

import type { ServiceTierOption } from '../lib'
import {
  AUTO_GROUP_FRAME_CLASS_NAME,
  AutoGroupFlowBorder,
  GroupRatioBadge,
} from './auto-group-visuals'

type ServiceTierCardsProps = Omit<
  ComponentProps<typeof RadioGroup>,
  'value' | 'onValueChange' | 'children'
> & {
  options: ServiceTierOption[]
  value?: string
  onValueChange: (value: string) => void
}

/**
 * The service tier picker: one required card per usable group, with the tier
 * the deployment leads with selected up front.
 */
export function ServiceTierCards({
  options,
  value,
  onValueChange,
  className,
  ...radioGroupProps
}: ServiceTierCardsProps) {
  const cardIdPrefix = useId()
  const shouldReduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  return (
    <RadioGroup
      value={value ?? ''}
      onValueChange={(next) => onValueChange(String(next))}
      className={cn('grid gap-3 sm:grid-cols-2', className)}
      {...radioGroupProps}
    >
      {options.map((option, index) => {
        // Indexed, because group names carry spaces and an id with a space
        // would split `aria-labelledby` into two references.
        const cardId = `${cardIdPrefix}-tier-${index}`
        const titleId = `${cardId}-title`
        const descriptionId = option.description
          ? `${cardId}-description`
          : undefined
        const isAuto = option.value === 'auto'
        const isSelected = option.value === value

        return (
          <label
            key={option.value}
            htmlFor={cardId}
            data-service-tier-card={option.value}
            className={cn(
              'bg-card border-input hover:border-primary/40 focus-within:border-primary focus-within:ring-primary/20 has-data-[checked]:border-primary has-data-[checked]:bg-primary/5 relative flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-colors focus-within:ring-[3px]',
              isAuto && AUTO_GROUP_FRAME_CLASS_NAME
            )}
          >
            {isAuto && (
              <AutoGroupFlowBorder shouldReduceMotion={shouldReduceMotion} />
            )}
            {/* Named by the tier alone: the wrapping label would otherwise
                read the whole card, blurb and badge included, as the name. */}
            {/* `absolute` on top of `sr-only`: the primitive's own base classes
                carry `relative size-4 border`, which win over what `sr-only`
                sets, so a bare `sr-only` would still reserve a 16px flex slot
                and push the title down. */}
            <RadioGroupItem
              id={cardId}
              value={option.value}
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              className='sr-only absolute size-px border-0'
            />
            <div className='flex items-start justify-between gap-2'>
              <span id={titleId} className='text-sm leading-none font-semibold'>
                {option.label}
              </span>
              <CircleCheck
                aria-hidden='true'
                className={cn(
                  'text-primary size-4 shrink-0 transition-opacity',
                  isSelected ? 'opacity-100' : 'opacity-0'
                )}
              />
            </div>
            {option.description && (
              <p id={descriptionId} className='text-muted-foreground text-xs'>
                {option.description}
              </p>
            )}
            <span className='mt-auto pt-1'>
              {option.pricingLabel ? (
                <Badge
                  variant='outline'
                  className='border-primary/30 bg-primary/10 text-primary text-[10px] sm:text-xs'
                >
                  {option.pricingLabel}
                </Badge>
              ) : (
                <GroupRatioBadge
                  ratio={option.ratio}
                  isAuto={isAuto}
                  shouldReduceMotion={shouldReduceMotion}
                />
              )}
            </span>
          </label>
        )
      })}
    </RadioGroup>
  )
}
