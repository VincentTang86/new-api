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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useModelDetailsDrawer } from '../hooks/use-model-details-drawer'
import { usePricingData } from '../hooks/use-pricing-data'
import { ModelDetailsDrawer } from './model-details'

const SKELETON_KEYS = ['first', 'second', 'third', 'fourth']

/**
 * Mounts the model details drawer for whichever model the URL names.
 *
 * Pages that show the pricing catalogue render one of these; the rows only
 * write the model into the URL. Pricing data comes from the same
 * `['pricing']` query the catalogue already loaded, so opening the drawer
 * costs no extra request.
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

  if (!modelId) return null

  const handleOpenChange = (open: boolean) => {
    if (!open) closeModel()
  }

  if (model) {
    return (
      <ModelDetailsDrawer
        open
        onOpenChange={handleOpenChange}
        model={model}
        groupRatio={groupRatio}
        usableGroup={usableGroup}
        endpointMap={
          endpointMap as Record<string, { path?: string; method?: string }>
        }
        autoGroups={autoGroups}
        tokenUnit={DEFAULT_TOKEN_UNIT}
      />
    )
  }

  // The catalogue is still loading, or the URL names a model this viewer
  // cannot see — either way the panel opens, because the URL asked for it.
  return (
    <Sheet open onOpenChange={handleOpenChange}>
      <SheetContent
        side='right'
        overlayClassName='bg-black/30 duration-200 supports-backdrop-filter:backdrop-blur-none'
        className='bg-background text-foreground top-[55px] bottom-0 flex h-auto w-[880px] max-w-[90vw] flex-col gap-0 overflow-hidden p-0 shadow-[-8px_0_24px_rgba(0,0,0,0.08)] duration-[350ms] data-ending-style:translate-x-full data-ending-style:opacity-100 data-starting-style:translate-x-full data-starting-style:opacity-100 motion-reduce:transition-none sm:max-w-[90vw]'
      >
        <SheetHeader className='sr-only'>
          <SheetTitle>{modelId}</SheetTitle>
          <SheetDescription>{t('Model details')}</SheetDescription>
        </SheetHeader>
        <div className='flex-1 overflow-y-auto px-5 pt-11 pb-8'>
          {isLoading ? (
            <div className='space-y-6'>
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
          ) : (
            <div className='mx-auto max-w-md pt-16 text-center'>
              <h2 className='mb-1 text-base font-semibold'>
                {t('Model not found')}
              </h2>
              <p className='text-muted-foreground mb-4 text-sm'>
                {t("The model you're looking for doesn't exist.")}
              </p>
              <Button onClick={closeModel} variant='outline' size='sm'>
                {t('Back to Models')}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
