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
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useModelDetailsDrawer } from '../hooks/use-model-details-drawer'
import { usePricingData } from '../hooks/use-pricing-data'
import type { PricingModel } from '../types'
import { ModelDetailsContent, ModelDetailsDrawer } from './model-details'

const SKELETON_KEYS = ['first', 'second', 'third', 'fourth']

/**
 * Mounts the model details drawer for whichever model the URL names.
 *
 * Pages that show the pricing catalogue render one of these; the rows only
 * write the model into the URL. Pricing data comes from the same `['pricing']`
 * query the catalogue already loaded, so opening the drawer costs no extra
 * request.
 *
 * The panel stays mounted and closes by flipping `open`, because unmounting it
 * would cut the slide-out short. That is also why the last model is held on
 * screen: the body must not blank out while the panel is still sliding away.
 */
export function ModelDetailsDrawerHost() {
  const { t } = useTranslation()
  const { modelId, closeModel } = useModelDetailsDrawer()
  const {
    models,
    groupRatio,
    usableGroup,
    endpointMap,
    autoGroups,
    isLoading,
  } = usePricingData()

  const model = useMemo(() => {
    if (!modelId) return null
    return models.find((entry) => entry.model_name === modelId) ?? null
  }, [models, modelId])

  const shown = useRef<{ id: string; model: PricingModel | null }>({
    id: '',
    model: null,
  })
  if (modelId) shown.current = { id: modelId, model }

  const open = modelId !== null
  // Nothing has been opened yet, so there is no panel to animate.
  if (!open && shown.current.id === '') return null

  const displayed = open ? model : shown.current.model

  // Three states, flat rather than nested: the model we have, the catalogue
  // still loading, or a URL naming a model this viewer cannot see.
  let body: React.ReactNode
  if (displayed) {
    body = (
      <ModelDetailsContent
        model={displayed}
        groupRatio={groupRatio}
        usableGroup={usableGroup}
        endpointMap={
          endpointMap as Record<string, { path?: string; method?: string }>
        }
        autoGroups={autoGroups}
        tokenUnit={DEFAULT_TOKEN_UNIT}
      />
    )
  } else if (isLoading) {
    body = (
      <div className='space-y-6 pt-6'>
        <div className='space-y-2'>
          <Skeleton className='h-7 w-64' />
          <Skeleton className='h-4 w-40' />
          <Skeleton className='h-4 w-full max-w-md' />
        </div>
        <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
          {SKELETON_KEYS.map((key) => (
            <Skeleton key={`metric-${key}`} className='h-16 w-full' />
          ))}
        </div>
        <div className='space-y-3'>
          {SKELETON_KEYS.map((key) => (
            <Skeleton key={`section-${key}`} className='h-24 w-full' />
          ))}
        </div>
      </div>
    )
  } else {
    body = (
      <div className='mx-auto max-w-md pt-16 text-center'>
        <h2 className='mb-1 text-base font-semibold'>{t('Model not found')}</h2>
        <p className='text-muted-foreground mb-4 text-sm'>
          {t("The model you're looking for doesn't exist.")}
        </p>
        <Button onClick={closeModel} variant='outline' size='sm'>
          {t('Back to Models')}
        </Button>
      </div>
    )
  }

  return (
    <ModelDetailsDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) closeModel()
      }}
      title={shown.current.id}
    >
      {body}
    </ModelDetailsDrawer>
  )
}
