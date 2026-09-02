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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Code2, Eye, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { JsonCodeEditor } from '@/components/json-code-editor'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ComboboxInput } from '@/components/ui/combobox-input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePricingData } from '@/features/pricing/hooks'
import {
  getRateConditions,
  getReferenceLaneKeys,
} from '@/features/pricing/lib/rate-conditions'
import type { PricingModel } from '@/features/pricing/types'

import {
  deleteReferencePricing,
  getReferencePricing,
  saveReferencePricing,
} from '../api'
import { SettingsSection } from '../components/settings-section'
import type {
  ReferencePricingLanes,
  ReferencePricingRow,
  ReferencePricingSource,
} from '../types'

const LANES = [
  { key: 'input', labelKey: 'Input price' },
  { key: 'output', labelKey: 'Output price' },
  { key: 'cached_input', labelKey: 'Cached input price' },
  { key: 'cache_creation', labelKey: 'Explicit cache write price' },
  { key: 'cache_creation_1h', labelKey: 'Explicit cache write price (1h)' },
  { key: 'cache_hit', labelKey: 'Explicit cache hit price' },
] as const

type LaneKey = (typeof LANES)[number]['key']

const SOURCES: ReferencePricingSource[] = ['official', 'openrouter']

/** Draft key for the default (unconditioned) price row of the matrix. */
const DEFAULT_CONDITION_KEY = ''

const priceSchema = z.number().positive().max(1_000_000)

const laneObjectSchema = z
  .object({
    input: priceSchema.optional(),
    output: priceSchema.optional(),
    cached_input: priceSchema.optional(),
    cache_creation: priceSchema.optional(),
    cache_creation_1h: priceSchema.optional(),
    cache_hit: priceSchema.optional(),
  })
  .strict()

const sourceObjectSchema = laneObjectSchema
  .extend({
    conditions: z
      .record(z.string().min(1).max(64), laneObjectSchema)
      .optional(),
  })
  .strict()

const jsonConfigSchema = z.record(
  z.string().trim().min(1).max(128),
  z
    .object({
      official: sourceObjectSchema.optional(),
      openrouter: sourceObjectSchema.optional(),
    })
    .strict()
)

type ModelRowView = {
  modelName: string
  rows: Partial<Record<ReferencePricingSource, ReferencePricingRow>>
}

type LaneDraft = Record<LaneKey, string>

/** Per source: condition key -> lane drafts; '' is the default price row. */
type DraftValues = Record<ReferencePricingSource, Record<string, LaneDraft>>

type DialogState = {
  modelName: string
  isNew: boolean
  values: DraftValues
}

const emptyLaneDraft = (): LaneDraft => ({
  input: '',
  output: '',
  cached_input: '',
  cache_creation: '',
  cache_creation_1h: '',
  cache_hit: '',
})

const lanesToDraft = (lanes: ReferencePricingLanes | undefined): LaneDraft => {
  const draft = emptyLaneDraft()
  if (!lanes) return draft
  for (const lane of LANES) {
    const price = lanes[lane.key]
    if (typeof price === 'number') draft[lane.key] = String(price)
  }
  return draft
}

const draftFromRows = (
  rows: Partial<Record<ReferencePricingSource, ReferencePricingRow>>
): DraftValues => {
  const values: DraftValues = { official: {}, openrouter: {} }
  for (const source of SOURCES) {
    const row = rows[source]
    values[source][DEFAULT_CONDITION_KEY] = lanesToDraft(row)
    for (const [conditionKey, lanes] of Object.entries(row?.conditions ?? {})) {
      if (conditionKey === DEFAULT_CONDITION_KEY) continue
      values[source][conditionKey] = lanesToDraft(lanes)
    }
  }
  return values
}

const formatLanePrice = (price: number | null | undefined) =>
  typeof price === 'number' ? `$${price}` : '—'

export function ReferencePricingCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { models: pricingModels } = usePricingData()

  const [editMode, setEditMode] = useState<'table' | 'json'>('table')
  const [jsonText, setJsonText] = useState('')
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['reference-pricing'],
    queryFn: getReferencePricing,
  })

  const serverRows = useMemo(() => query.data?.data ?? [], [query.data])

  const modelRows = useMemo<ModelRowView[]>(() => {
    const byModel = new Map<string, ModelRowView>()
    for (const row of serverRows) {
      let view = byModel.get(row.model_name)
      if (!view) {
        view = { modelName: row.model_name, rows: {} }
        byModel.set(row.model_name, view)
      }
      view.rows[row.source] = row
    }
    return [...byModel.values()].sort((a, b) =>
      a.modelName.localeCompare(b.modelName, 'en', { numeric: true })
    )
  }, [serverRows])

  const modelNameOptions = useMemo(() => {
    const configured = new Set(modelRows.map((row) => row.modelName))
    return pricingModels
      .filter((model) => !configured.has(model.model_name))
      .map((model) => ({ value: model.model_name, label: model.model_name }))
  }, [pricingModels, modelRows])

  const dialogModel = useMemo<PricingModel | undefined>(() => {
    if (!dialog) return undefined
    return pricingModels.find((model) => model.model_name === dialog.modelName)
  }, [pricingModels, dialog])

  // The matrix rows: the fixed default row, then every rate condition the
  // model's billing expression derives — the same list, labels and keys the
  // details drawer renders, which is what keeps the two views aligned.
  const derivedConditions = useMemo(() => {
    if (!dialogModel) return []
    return getRateConditions(dialogModel, t).filter(
      (condition) => condition.key !== DEFAULT_CONDITION_KEY
    )
  }, [dialogModel, t])

  // Columns: only the lanes this model's own pricing table renders.
  const laneColumns = useMemo(() => {
    if (!dialogModel) return [...LANES]
    const keys = new Set(getReferenceLaneKeys(dialogModel))
    return LANES.filter((lane) => keys.has(lane.key))
  }, [dialogModel])

  const saveMutation = useMutation({ mutationFn: saveReferencePricing })
  const deleteMutation = useMutation({ mutationFn: deleteReferencePricing })
  const isMutating = saveMutation.isPending || deleteMutation.isPending

  const invalidatePricing = () => {
    void queryClient.invalidateQueries({ queryKey: ['reference-pricing'] })
    void queryClient.invalidateQueries({ queryKey: ['pricing'] })
  }

  const buildJsonText = () => {
    const config: Record<string, Record<string, unknown>> = {}
    for (const view of modelRows) {
      const entry: Record<string, unknown> = {}
      for (const source of SOURCES) {
        const row = view.rows[source]
        if (!row) continue
        const lanes: Record<string, unknown> = {}
        for (const lane of LANES) {
          const price = row[lane.key]
          if (typeof price === 'number') lanes[lane.key] = price
        }
        const conditions: Record<string, Record<string, number>> = {}
        for (const [conditionKey, conditionLanes] of Object.entries(
          row.conditions ?? {}
        )) {
          const entryLanes: Record<string, number> = {}
          for (const lane of LANES) {
            const price = conditionLanes[lane.key]
            if (typeof price === 'number') entryLanes[lane.key] = price
          }
          if (Object.keys(entryLanes).length > 0) {
            conditions[conditionKey] = entryLanes
          }
        }
        if (Object.keys(conditions).length > 0) lanes.conditions = conditions
        entry[source] = lanes
      }
      config[view.modelName] = entry
    }
    return JSON.stringify(config, null, 2)
  }

  const toggleEditMode = () => {
    setEditMode((prev) => {
      if (prev === 'table') {
        setJsonText(buildJsonText())
        return 'json'
      }
      return 'table'
    })
  }

  const openAddDialog = () => {
    setDialog({
      modelName: '',
      isNew: true,
      values: draftFromRows({}),
    })
  }

  const openEditDialog = (view: ModelRowView) => {
    setDialog({
      modelName: view.modelName,
      isNew: false,
      values: draftFromRows(view.rows),
    })
  }

  const setDraftValue = (
    source: ReferencePricingSource,
    conditionKey: string,
    laneKey: LaneKey,
    value: string
  ) => {
    setDialog((prev) => {
      if (!prev) return prev
      const sourceDraft = { ...prev.values[source] }
      sourceDraft[conditionKey] = {
        ...(sourceDraft[conditionKey] ?? emptyLaneDraft()),
        [laneKey]: value,
      }
      return {
        ...prev,
        values: { ...prev.values, [source]: sourceDraft },
      }
    })
  }

  const removeDraftCondition = (
    source: ReferencePricingSource,
    conditionKey: string
  ) => {
    setDialog((prev) => {
      if (!prev) return prev
      const sourceDraft = { ...prev.values[source] }
      delete sourceDraft[conditionKey]
      return {
        ...prev,
        values: { ...prev.values, [source]: sourceDraft },
      }
    })
  }

  const parseDraftLanes = (
    draft: LaneDraft | undefined
  ): Partial<Record<LaneKey, number>> | null => {
    const lanes: Partial<Record<LaneKey, number>> = {}
    for (const lane of LANES) {
      const raw = (draft?.[lane.key] ?? '').trim()
      if (!raw) continue
      const price = Number(raw)
      if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) {
        return null
      }
      lanes[lane.key] = price
    }
    return lanes
  }

  const handleDialogSave = async () => {
    if (!dialog) return
    const modelName = dialog.modelName.trim()
    if (!modelName || modelName.length > 128) {
      toast.error(t('Model name is required'))
      return
    }
    if (dialog.isNew && modelRows.some((row) => row.modelName === modelName)) {
      toast.error(t('This model is already configured'))
      return
    }
    const existing = modelRows.find((row) => row.modelName === modelName)
    const rows: ReferencePricingRow[] = []
    for (const source of SOURCES) {
      const sourceDraft = dialog.values[source]
      const defaultLanes = parseDraftLanes(sourceDraft[DEFAULT_CONDITION_KEY])
      if (defaultLanes === null) {
        toast.error(t('Prices must be positive numbers'))
        return
      }
      const conditions: Record<string, Partial<Record<LaneKey, number>>> = {}
      for (const [conditionKey, draft] of Object.entries(sourceDraft)) {
        if (conditionKey === DEFAULT_CONDITION_KEY) continue
        const lanes = parseDraftLanes(draft)
        if (lanes === null) {
          toast.error(t('Prices must be positive numbers'))
          return
        }
        if (Object.keys(lanes).length > 0) conditions[conditionKey] = lanes
      }
      const hasValue =
        Object.keys(defaultLanes).length > 0 ||
        Object.keys(conditions).length > 0
      // 清空某来源全部价格时仍要提交该行，让后端把旧值整行覆盖为空
      if (hasValue || existing?.rows[source]) {
        rows.push({
          model_name: modelName,
          source,
          ...defaultLanes,
          ...(Object.keys(conditions).length > 0 ? { conditions } : {}),
        })
      }
    }
    if (rows.length === 0) {
      toast.error(t('Enter at least one price'))
      return
    }
    const res = await saveMutation.mutateAsync(rows)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    invalidatePricing()
    toast.success(t('Benchmark prices saved'))
    setDialog(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await deleteMutation.mutateAsync(deleteTarget)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    invalidatePricing()
    toast.success(t('Benchmark prices deleted'))
    setDeleteTarget(null)
  }

  const handleJsonSave = async () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      toast.error(t('Invalid JSON format'))
      return
    }
    const result = jsonConfigSchema.safeParse(parsed)
    if (!result.success) {
      toast.error(t('Invalid JSON format'))
      return
    }
    const rows: ReferencePricingRow[] = []
    for (const [modelName, sources] of Object.entries(result.data)) {
      for (const source of SOURCES) {
        const entry = sources[source]
        if (!entry) continue
        const { conditions, ...lanes } = entry
        rows.push({
          model_name: modelName,
          source,
          ...lanes,
          ...(conditions && Object.keys(conditions).length > 0
            ? { conditions }
            : {}),
        })
      }
    }
    // JSON 是完整状态：先删掉被移除的模型，再整体 upsert
    const removed = modelRows
      .map((row) => row.modelName)
      .filter((name) => !(name in result.data))
    for (const name of removed) {
      const res = await deleteMutation.mutateAsync(name)
      if (!res.success) {
        toast.error(res.message)
        return
      }
    }
    if (rows.length > 0) {
      const res = await saveMutation.mutateAsync(rows)
      if (!res.success) {
        toast.error(res.message)
        return
      }
    }
    invalidatePricing()
    toast.success(t('Benchmark prices saved'))
    setEditMode('table')
  }

  const sourceLabel = (source: ReferencePricingSource) =>
    source === 'official' ? t('Official API') : 'OpenRouter'

  const conditionCount = (view: ModelRowView): number => {
    const keys = new Set<string>()
    for (const source of SOURCES) {
      for (const key of Object.keys(view.rows[source]?.conditions ?? {})) {
        keys.add(key)
      }
    }
    return keys.size
  }

  const renderSourceMatrix = (source: ReferencePricingSource) => {
    if (!dialog) return null
    const sourceDraft = dialog.values[source]
    const derivedKeys = new Set(
      derivedConditions.map((condition) => condition.key)
    )
    // Stored conditions the expression no longer derives (renamed tier,
    // rewritten expression); kept visible so stale prices can be cleared.
    const orphanKeys = Object.keys(sourceDraft).filter(
      (key) => key !== DEFAULT_CONDITION_KEY && !derivedKeys.has(key)
    )

    const matrixRows: {
      key: string
      label: string
      detail?: string
      orphan: boolean
    }[] = [
      { key: DEFAULT_CONDITION_KEY, label: t('Default price'), orphan: false },
      ...derivedConditions.map((condition) => ({
        key: condition.key,
        label: condition.label,
        detail: condition.detail,
        orphan: false,
      })),
      ...orphanKeys.map((key) => ({ key, label: key, orphan: true })),
    ]

    return (
      <div className='overflow-x-auto rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Rate Conditions')}</TableHead>
              {laneColumns.map((lane) => (
                <TableHead
                  key={lane.key}
                  className='min-w-28 whitespace-normal'
                >
                  {t(lane.labelKey)}
                </TableHead>
              ))}
              <TableHead className='w-8' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {matrixRows.map((row) => (
              <TableRow
                key={row.key || 'default'}
                className={
                  row.orphan ? 'bg-amber-50/60 dark:bg-amber-500/10' : undefined
                }
              >
                <TableCell className='text-xs whitespace-nowrap'>
                  <span className='flex flex-col'>
                    <span className={row.orphan ? 'font-mono' : 'font-medium'}>
                      {row.label}
                    </span>
                    {row.detail && (
                      <span className='text-muted-foreground text-[10px]'>
                        {row.detail}
                      </span>
                    )}
                    {row.orphan && (
                      <span className='text-muted-foreground text-[10px]'>
                        {t('Not derived from the current billing expression')}
                      </span>
                    )}
                  </span>
                </TableCell>
                {laneColumns.map((lane) => (
                  <TableCell key={lane.key}>
                    <Input
                      aria-label={`${row.label} · ${t(lane.labelKey)}`}
                      type='number'
                      min={0}
                      step='any'
                      inputMode='decimal'
                      className='h-8'
                      value={sourceDraft[row.key]?.[lane.key] ?? ''}
                      onChange={(event) =>
                        setDraftValue(
                          source,
                          row.key,
                          lane.key,
                          event.target.value
                        )
                      }
                    />
                  </TableCell>
                ))}
                <TableCell>
                  {row.orphan && (
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-sm'
                      aria-label={t('Remove condition')}
                      onClick={() => removeDraftCondition(source, row.key)}
                    >
                      <X />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <SettingsSection title={t('Benchmark Prices')}>
      <p className='text-muted-foreground text-sm'>
        {t(
          'External list prices per model (USD per 1M tokens), used for the pricing page comparison and the dashboard savings estimate.'
        )}
      </p>

      <div className='flex flex-wrap justify-end gap-2'>
        {editMode === 'table' ? (
          <Button type='button' size='sm' onClick={openAddDialog}>
            <Plus data-icon='inline-start' />
            {t('Add model')}
          </Button>
        ) : (
          <Button
            type='button'
            size='sm'
            onClick={handleJsonSave}
            disabled={isMutating}
          >
            {isMutating ? t('Saving...') : t('Save')}
          </Button>
        )}
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={toggleEditMode}
        >
          {editMode === 'table' ? (
            <>
              <Code2 data-icon='inline-start' />
              {t('Switch to JSON')}
            </>
          ) : (
            <>
              <Eye data-icon='inline-start' />
              {t('Switch to Visual')}
            </>
          )}
        </Button>
      </div>

      {editMode === 'json' && (
        <>
          <p className='text-muted-foreground text-xs'>
            {t(
              'The JSON is the complete state: models or conditions omitted here are removed on save.'
            )}
          </p>
          <JsonCodeEditor
            value={jsonText}
            onChange={setJsonText}
            heightClassName='h-96 min-h-96 max-h-96'
            ariaLabel={t('Benchmark Prices')}
          />
        </>
      )}
      {editMode === 'table' && query.isLoading && (
        <div className='space-y-2'>
          <Skeleton className='h-9 w-full' />
          <Skeleton className='h-9 w-full' />
          <Skeleton className='h-9 w-full' />
        </div>
      )}
      {editMode === 'table' && !query.isLoading && (
        <div className='overflow-x-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Model name')}</TableHead>
                <TableHead>
                  {t('Official API')} · {t('Input price')} / {t('Output price')}
                </TableHead>
                <TableHead>
                  OpenRouter · {t('Input price')} / {t('Output price')}
                </TableHead>
                <TableHead>{t('Rate Conditions')}</TableHead>
                <TableHead className='w-24' />
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-muted-foreground text-center'
                  >
                    {t('No benchmark prices configured yet')}
                  </TableCell>
                </TableRow>
              ) : (
                modelRows.map((view) => {
                  const count = conditionCount(view)
                  return (
                    <TableRow key={view.modelName}>
                      <TableCell className='font-mono text-sm'>
                        {view.modelName}
                      </TableCell>
                      <TableCell>
                        {formatLanePrice(view.rows.official?.input)} /{' '}
                        {formatLanePrice(view.rows.official?.output)}
                      </TableCell>
                      <TableCell>
                        {formatLanePrice(view.rows.openrouter?.input)} /{' '}
                        {formatLanePrice(view.rows.openrouter?.output)}
                      </TableCell>
                      <TableCell className='text-xs'>
                        {count > 0
                          ? t('Default +{{count}}', { count })
                          : t('Default only')}
                      </TableCell>
                      <TableCell>
                        <div className='flex justify-end gap-1'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-sm'
                            aria-label={t('Edit')}
                            onClick={() => openEditDialog(view)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-sm'
                            aria-label={t('Delete')}
                            onClick={() => setDeleteTarget(view.modelName)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      >
        <DialogContent className='sm:max-w-6xl'>
          <DialogHeader>
            <DialogTitle>
              {dialog?.isNew ? t('Add model') : t('Edit benchmark prices')}
            </DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className='flex max-h-[70vh] flex-col gap-4 overflow-y-auto'>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='reference-pricing-model-name'>
                  {t('Model name')}
                </Label>
                {dialog.isNew ? (
                  <ComboboxInput
                    id='reference-pricing-model-name'
                    options={modelNameOptions}
                    value={dialog.modelName}
                    onValueChange={(value) =>
                      setDialog((prev) =>
                        prev ? { ...prev, modelName: value } : prev
                      )
                    }
                    allowCustomValue
                  />
                ) : (
                  <Input
                    id='reference-pricing-model-name'
                    value={dialog.modelName}
                    disabled
                  />
                )}
              </div>
              <Tabs defaultValue='official'>
                <TabsList>
                  {SOURCES.map((source) => (
                    <TabsTrigger key={source} value={source}>
                      {sourceLabel(source)}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {SOURCES.map((source) => (
                  <TabsContent key={source} value={source} className='pt-2'>
                    {renderSourceMatrix(source)}
                  </TabsContent>
                ))}
              </Tabs>
              <p className='text-muted-foreground text-xs'>
                {t('Leave a field empty when the source has no such price.')}{' '}
                {t(
                  'The default price also feeds the landing page comparison and the dashboard savings estimate; a condition without its own price shows a dash in the model drawer.'
                )}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setDialog(null)}
            >
              {t('Cancel')}
            </Button>
            <Button
              type='button'
              onClick={handleDialogSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? t('Saving...') : t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Delete benchmark prices for {{name}}?', {
                name: deleteTarget ?? '',
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'The pricing page comparison and dashboard savings for this model will show a dash.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  )
}
