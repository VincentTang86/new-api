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
import { useMemo, useState, type ReactNode } from 'react'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { usePricingData } from '@/features/pricing/hooks'
import {
  isImageModel,
  isVideoModel,
} from '@/features/pricing/lib/model-helpers'
import { tokenPriceUSD } from '@/features/pricing/lib/price'
import {
  getRateConditions,
  getReferenceLaneKeys,
} from '@/features/pricing/lib/rate-conditions'
import {
  isVideoRateCondition,
  VIDEO_RATE_CONDITION_LABELS,
  VIDEO_RATE_CONDITIONS,
} from '@/features/pricing/lib/video-grid'
import type {
  PricingModel,
  VideoRateCondition,
} from '@/features/pricing/types'

import {
  deleteReferencePricing,
  getReferencePricing,
  saveReferencePricing,
} from '../api'
import { SettingsSection } from '../components/settings-section'
import type {
  ReferencePricingImageSize,
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
  { key: 'image_input', labelKey: 'Image input price' },
  { key: 'image_output', labelKey: 'Image output price' },
] as const

type LaneKey = (typeof LANES)[number]['key']

/** External sources that carry per-token lanes and rate conditions. */
type LaneSource = Exclude<ReferencePricingSource, 'gateway'>

const SOURCES: LaneSource[] = ['official', 'openrouter']

/**
 * Rows of the per-unit price matrices. The gateway row is this site's own list
 * price (at group ratio 1); the drawer scales it by each tier's ratio.
 */
const PER_UNIT_SOURCES: ReferencePricingSource[] = [
  'gateway',
  'official',
  'openrouter',
]

const MAX_PRICE_TIERS = 16

/**
 * Columns a video model's grid opens with, as the design lays them out. 480p
 * and 720p bill alike per token but differ 2.25x per second (they differ in
 * pixel count), so an admin who wants exact per-second figures splits them
 * into two columns; the labels are free text either way.
 */
const DEFAULT_VIDEO_RESOLUTIONS = ['480p / 720p', '1080p', '4K']

/** Draft key for the default (unconditioned) price row of the matrix. */
const DEFAULT_CONDITION_KEY = ''

/** Toggle value that stands for "no rate condition" in the video grid. */
const NO_CONDITION_TOGGLE = 'none'

const priceSchema = z.number().positive().max(1_000_000)

const laneObjectSchema = z
  .object({
    input: priceSchema.optional(),
    output: priceSchema.optional(),
    cached_input: priceSchema.optional(),
    cache_creation: priceSchema.optional(),
    cache_creation_1h: priceSchema.optional(),
    cache_hit: priceSchema.optional(),
    image_input: priceSchema.optional(),
    image_output: priceSchema.optional(),
  })
  .strict()

// A video grid prices every column under each condition, so the list may hold
// up to columns × conditions entries.
const perUnitSchema = z
  .array(
    z
      .object({
        size: z.string().trim().min(1).max(32),
        price: priceSchema,
        condition: z.enum(VIDEO_RATE_CONDITIONS).optional(),
      })
      .strict()
  )
  .max(MAX_PRICE_TIERS * VIDEO_RATE_CONDITIONS.length)

const videoGridSchema = z
  .object({
    conditions: z
      .array(z.enum(VIDEO_RATE_CONDITIONS))
      .max(VIDEO_RATE_CONDITIONS.length),
    resolutions: z
      .array(z.string().trim().min(1).max(32))
      .max(MAX_PRICE_TIERS),
  })
  .strict()

const sourceObjectSchema = laneObjectSchema
  .extend({
    conditions: z
      .record(z.string().min(1).max(64), laneObjectSchema)
      .optional(),
    per_image: perUnitSchema.optional(),
    per_image_input: priceSchema.optional(),
    per_second: perUnitSchema.optional(),
    per_token: perUnitSchema.optional(),
  })
  .strict()

const gatewayObjectSchema = z
  .object({
    per_image: perUnitSchema.optional(),
    per_image_input: priceSchema.optional(),
    per_second: perUnitSchema.optional(),
    per_token: perUnitSchema.optional(),
    video_grid: videoGridSchema.optional(),
  })
  .strict()

const jsonConfigSchema = z.record(
  z.string().trim().min(1).max(128),
  z
    .object({
      official: sourceObjectSchema.optional(),
      openrouter: sourceObjectSchema.optional(),
      gateway: gatewayObjectSchema.optional(),
    })
    .strict()
)

type ModelRowView = {
  modelName: string
  rows: Partial<Record<ReferencePricingSource, ReferencePricingRow>>
}

type LaneDraft = Record<LaneKey, string>

/** Per source: condition key -> lane drafts; '' is the default price row. */
type DraftValues = Record<LaneSource, Record<string, LaneDraft>>

/**
 * One column of a per-unit price matrix as typed: the tier label. The id
 * keeps a column's identity while its label is still being typed.
 */
type PerUnitColumn = {
  id: number
  size: string
}

/** Key of one price box: source × condition ('' when unconditioned) × column. */
const cellKey = (
  source: ReferencePricingSource,
  condition: string,
  columnId: number
) => `${source}|${condition}|${columnId}`

/** An image model's per-image matrix: sizes across, one row per source. */
type PerImageDraft = {
  columns: PerUnitColumn[]
  nextId: number
  /** Price text per cell, keyed by `cellKey`; '' when the source has none. */
  cells: Record<string, string>
  /** Each source's charge per input image as typed ('' when none). */
  inputPrices: Record<ReferencePricingSource, string>
}

/**
 * A video model's grid: one set of resolution columns and rate conditions,
 * priced twice over — per second and per 1M tokens — by every source.
 */
type VideoDraft = {
  columns: PerUnitColumn[]
  nextId: number
  conditions: VideoRateCondition[]
  perSecond: Record<string, string>
  perToken: Record<string, string>
}

type DialogState = {
  modelName: string
  isNew: boolean
  values: DraftValues
  perImage: PerImageDraft
  video: VideoDraft
}

type ColumnDraft = { columns: PerUnitColumn[]; nextId: number }

const addColumn = <T extends ColumnDraft>(prev: T): T => ({
  ...prev,
  columns: [...prev.columns, { id: prev.nextId, size: '' }],
  nextId: prev.nextId + 1,
})

const removeColumn = <T extends ColumnDraft>(prev: T, id: number): T => ({
  ...prev,
  columns: prev.columns.filter((column) => column.id !== id),
})

const relabelColumn = <T extends ColumnDraft>(
  prev: T,
  id: number,
  size: string
): T => ({
  ...prev,
  columns: prev.columns.map((column) =>
    column.id === id ? { ...column, size } : column
  ),
})

const emptyLaneDraft = (): LaneDraft => ({
  input: '',
  output: '',
  cached_input: '',
  cache_creation: '',
  cache_creation_1h: '',
  cache_hit: '',
  image_input: '',
  image_output: '',
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

/**
 * Columns are the union of every source's size labels, the gateway's order
 * first (it is the order the drawer renders), then whatever the external
 * sources add.
 */
const perImageDraftFromRows = (
  rows: Partial<Record<ReferencePricingSource, ReferencePricingRow>>
): PerImageDraft => {
  const columns: PerUnitColumn[] = []
  const cells: Record<string, string> = {}
  for (const source of PER_UNIT_SOURCES) {
    for (const entry of rows[source]?.per_image ?? []) {
      let column = columns.find((item) => item.size === entry.size)
      if (!column) {
        column = { id: columns.length, size: entry.size }
        columns.push(column)
      }
      cells[cellKey(source, '', column.id)] = String(entry.price)
    }
  }
  const inputPrices = { gateway: '', official: '', openrouter: '' }
  for (const source of PER_UNIT_SOURCES) {
    const price = rows[source]?.per_image_input
    if (typeof price === 'number') inputPrices[source] = String(price)
  }
  return { columns, nextId: columns.length, cells, inputPrices }
}

/**
 * The stored grid defines the columns and conditions. A model priced before
 * grids existed derives them from its stored prices, the gateway's order
 * first, and a video model with nothing stored opens on the usual resolutions
 * so the admin fills prices rather than inventing labels. A price stored
 * outside the grid still gets its column and condition, so nothing on file
 * is hidden from the editor.
 */
const videoDraftFromRows = (
  rows: Partial<Record<ReferencePricingSource, ReferencePricingRow>>,
  seedResolutions: readonly string[]
): VideoDraft => {
  const grid = rows.gateway?.video_grid
  const columns: PerUnitColumn[] = (grid?.resolutions ?? []).map(
    (size, id) => ({ id, size })
  )
  const conditions = new Set(
    (grid?.conditions ?? []).filter(isVideoRateCondition)
  )
  const perSecond: Record<string, string> = {}
  const perToken: Record<string, string> = {}
  for (const source of PER_UNIT_SOURCES) {
    for (const [field, cells] of [
      ['per_second', perSecond],
      ['per_token', perToken],
    ] as const) {
      for (const entry of rows[source]?.[field] ?? []) {
        const condition = entry.condition ?? ''
        if (condition !== '') {
          if (!isVideoRateCondition(condition)) continue
          conditions.add(condition)
        }
        let column = columns.find((item) => item.size === entry.size)
        if (!column) {
          column = { id: columns.length, size: entry.size }
          columns.push(column)
        }
        cells[cellKey(source, condition, column.id)] = String(entry.price)
      }
    }
  }
  if (columns.length === 0) {
    for (const size of seedResolutions) {
      columns.push({ id: columns.length, size })
    }
  }
  return {
    columns,
    nextId: columns.length,
    conditions: VIDEO_RATE_CONDITIONS.filter((condition) =>
      conditions.has(condition)
    ),
    perSecond,
    perToken,
  }
}

/**
 * A source's charge per input image: undefined when left blank, null when
 * the text is not a positive price.
 */
const parsePerUnitInput = (
  draft: PerImageDraft,
  source: ReferencePricingSource
): number | null | undefined => {
  const raw = draft.inputPrices[source].trim()
  if (!raw) return undefined
  const price = Number(raw)
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) return null
  return price
}

/**
 * The per-unit list a source submits: every column where it has a price,
 * under each condition the grid splits on (a single unconditioned row when
 * none). Null flags a price that is not a positive number, or a blank or
 * duplicate column label that still carries a price.
 */
const parseGridCells = (
  columns: readonly PerUnitColumn[],
  conditions: readonly VideoRateCondition[],
  cells: Record<string, string>,
  source: ReferencePricingSource
): ReferencePricingImageSize[] | null => {
  const entries: ReferencePricingImageSize[] = []
  const seen = new Set<string>()
  const rowConditions: readonly string[] =
    conditions.length > 0 ? conditions : ['']
  for (const column of columns) {
    const size = column.size.trim()
    let priced = false
    for (const condition of rowConditions) {
      const raw = (cells[cellKey(source, condition, column.id)] ?? '').trim()
      if (!raw) continue
      if (!size || size.length > 32 || seen.has(size)) return null
      const price = Number(raw)
      if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) {
        return null
      }
      entries.push({ size, price, ...(condition ? { condition } : {}) })
      priced = true
    }
    if (priced) seen.add(size)
  }
  return entries
}

/**
 * One per-unit price matrix: sources down the side, tiers across the top, and
 * a price box in every cell. Image models price by size and add a fixed
 * "input image" column; video models price by output resolution and, when
 * their grid splits on rate conditions, one row per condition under each
 * source. The tier labels are free text so an admin can follow whatever
 * tiers the vendor actually publishes.
 */
function PerUnitPriceMatrix(props: {
  columns: PerUnitColumn[]
  /** Rows under each source; empty renders a single unlabelled row. */
  conditions: readonly VideoRateCondition[]
  cellValue: (
    source: ReferencePricingSource,
    condition: string,
    columnId: number
  ) => string
  onCellChange: (
    source: ReferencePricingSource,
    condition: string,
    columnId: number,
    value: string
  ) => void
  onAddColumn: () => void
  onRemoveColumn: (id: number) => void
  onColumnLabelChange: (id: number, value: string) => void
  /** The fixed input-image column (image models): each source's charge as typed. */
  inputPrices?: Record<ReferencePricingSource, string>
  onInputPriceChange?: (source: ReferencePricingSource, value: string) => void
  /** Rendered beside the add-column button. */
  action?: ReactNode
  label: string
  description: string
  addLabel: string
  tierLabel: string
  removeLabel: string
  sourceLabel: (source: ReferencePricingSource) => string
  t: (key: string) => string
}) {
  const { columns, sourceLabel, t } = props
  const rowConditions: readonly (VideoRateCondition | '')[] =
    props.conditions.length > 0 ? props.conditions : ['']

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between gap-2'>
        <div>
          <Label>{props.label}</Label>
          <p className='text-muted-foreground text-xs'>{props.description}</p>
        </div>
        <div className='flex items-center gap-2'>
          {props.action}
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={props.onAddColumn}
            disabled={columns.length >= MAX_PRICE_TIERS}
          >
            <Plus data-icon='inline-start' />
            {props.addLabel}
          </Button>
        </div>
      </div>
      <div className='overflow-x-auto rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='whitespace-nowrap'>{t('Source')}</TableHead>
              {props.conditions.length > 0 && (
                <TableHead className='whitespace-nowrap'>
                  {t('Rate Conditions')}
                </TableHead>
              )}
              {/* The input-image column is fixed: xAI-style media input is one
               * charge per attached image, not a size tier. */}
              {props.inputPrices && (
                <TableHead className='min-w-32 whitespace-nowrap'>
                  {t('Input image')}
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead key={column.id} className='min-w-32'>
                  <div className='flex items-center gap-1'>
                    <Input
                      aria-label={props.tierLabel}
                      placeholder={props.tierLabel}
                      className='h-8 font-mono'
                      value={column.size}
                      onChange={(event) =>
                        props.onColumnLabelChange(column.id, event.target.value)
                      }
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-sm'
                      aria-label={props.removeLabel}
                      onClick={() => props.onRemoveColumn(column.id)}
                    >
                      <X />
                    </Button>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PER_UNIT_SOURCES.map((source) =>
              rowConditions.map((condition, index) => {
                const conditionLabel = condition
                  ? t(VIDEO_RATE_CONDITION_LABELS[condition])
                  : ''
                const rowLabel = conditionLabel
                  ? `${sourceLabel(source)} · ${conditionLabel}`
                  : sourceLabel(source)
                return (
                  <TableRow key={`${source}-${condition}`}>
                    {index === 0 && (
                      <TableCell
                        rowSpan={rowConditions.length}
                        className='text-xs font-medium whitespace-nowrap'
                      >
                        {sourceLabel(source)}
                      </TableCell>
                    )}
                    {condition && (
                      <TableCell className='text-muted-foreground text-xs whitespace-nowrap'>
                        {conditionLabel}
                      </TableCell>
                    )}
                    {props.inputPrices && (
                      <TableCell>
                        <Input
                          aria-label={`${rowLabel} · ${t('Input image')}`}
                          type='number'
                          min={0}
                          step='any'
                          inputMode='decimal'
                          className='h-8'
                          value={props.inputPrices[source]}
                          onChange={(event) =>
                            props.onInputPriceChange?.(
                              source,
                              event.target.value
                            )
                          }
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell key={column.id}>
                        <Input
                          aria-label={`${rowLabel} · ${column.size || props.tierLabel}`}
                          type='number'
                          min={0}
                          step='any'
                          inputMode='decimal'
                          className='h-8'
                          value={props.cellValue(source, condition, column.id)}
                          onChange={(event) =>
                            props.onCellChange(
                              source,
                              condition,
                              column.id,
                              event.target.value
                            )
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
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
      const gateway = view.rows.gateway
      if (
        gateway?.per_image?.length ||
        gateway?.per_second?.length ||
        gateway?.per_token?.length ||
        gateway?.video_grid ||
        typeof gateway?.per_image_input === 'number'
      ) {
        entry.gateway = {
          ...(gateway.per_image?.length
            ? { per_image: gateway.per_image }
            : {}),
          ...(gateway.per_second?.length
            ? { per_second: gateway.per_second }
            : {}),
          ...(gateway.per_token?.length
            ? { per_token: gateway.per_token }
            : {}),
          ...(gateway.video_grid ? { video_grid: gateway.video_grid } : {}),
          ...(typeof gateway.per_image_input === 'number'
            ? { per_image_input: gateway.per_image_input }
            : {}),
        }
      }
      for (const source of SOURCES) {
        const row = view.rows[source]
        if (!row) continue
        const lanes: Record<string, unknown> = {}
        for (const lane of LANES) {
          const price = row[lane.key]
          if (typeof price === 'number') lanes[lane.key] = price
        }
        if (row.per_image?.length) lanes.per_image = row.per_image
        if (row.per_second?.length) lanes.per_second = row.per_second
        if (row.per_token?.length) lanes.per_token = row.per_token
        if (typeof row.per_image_input === 'number') {
          lanes.per_image_input = row.per_image_input
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
      perImage: perImageDraftFromRows({}),
      video: videoDraftFromRows({}, []),
    })
  }

  const openEditDialog = (view: ModelRowView) => {
    setDialog({
      modelName: view.modelName,
      isNew: false,
      values: draftFromRows(view.rows),
      perImage: perImageDraftFromRows(view.rows),
      // A video model opens on the usual resolution columns so the admin
      // fills prices rather than first inventing column labels.
      video: videoDraftFromRows(
        view.rows,
        pricingModels.some(
          (item) => item.model_name === view.modelName && isVideoModel(item)
        )
          ? DEFAULT_VIDEO_RESOLUTIONS
          : []
      ),
    })
  }

  const setPerImage = (update: (prev: PerImageDraft) => PerImageDraft) => {
    setDialog((prev) =>
      prev ? { ...prev, perImage: update(prev.perImage) } : prev
    )
  }

  const setVideo = (update: (prev: VideoDraft) => VideoDraft) => {
    setDialog((prev) => (prev ? { ...prev, video: update(prev.video) } : prev))
  }

  // The gateway's per-token cells start from what billing actually charges:
  // the base rate times each tier's multiplier, matched to a column by the
  // resolution label the billing lookup reports. Written into the boxes only;
  // the admin still reviews and saves.
  const prefillGatewayTokenPrices = () => {
    const rates = dialogModel?.video_rates
    if (!dialogModel || !rates?.length) return
    const baseUSD = tokenPriceUSD(dialogModel, 'input', 1)
    setVideo((prev) => {
      const perToken = { ...prev.perToken }
      const rowConditions: readonly string[] =
        prev.conditions.length > 0 ? prev.conditions : ['']
      for (const column of prev.columns) {
        const label = column.size.trim().toLowerCase()
        for (const condition of rowConditions) {
          const rate = rates.find(
            (item) =>
              item.resolution.toLowerCase() === label &&
              item.with_video === (condition === 'with_video')
          )
          if (!rate) continue
          perToken[cellKey('gateway', condition, column.id)] = String(
            Number((baseUSD * rate.ratio).toFixed(6))
          )
        }
      }
      return { ...prev, perToken }
    })
  }

  const setDraftValue = (
    source: LaneSource,
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

  const removeDraftCondition = (source: LaneSource, conditionKey: string) => {
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
    const perImageBySource = {} as Record<
      ReferencePricingSource,
      ReferencePricingImageSize[]
    >
    const perSecondBySource = {} as Record<
      ReferencePricingSource,
      ReferencePricingImageSize[]
    >
    const perTokenBySource = {} as Record<
      ReferencePricingSource,
      ReferencePricingImageSize[]
    >
    const perImageInputBySource = {} as Record<
      ReferencePricingSource,
      number | undefined
    >
    for (const source of PER_UNIT_SOURCES) {
      const entries = parseGridCells(
        dialog.perImage.columns,
        [],
        dialog.perImage.cells,
        source
      )
      const inputPrice = parsePerUnitInput(dialog.perImage, source)
      if (entries === null || inputPrice === null) {
        toast.error(
          t('Per-image prices need a unique size and a positive price')
        )
        return
      }
      const seconds = parseGridCells(
        dialog.video.columns,
        dialog.video.conditions,
        dialog.video.perSecond,
        source
      )
      if (seconds === null) {
        toast.error(
          t('Per-second prices need a unique resolution and a positive price')
        )
        return
      }
      const tokens = parseGridCells(
        dialog.video.columns,
        dialog.video.conditions,
        dialog.video.perToken,
        source
      )
      if (tokens === null) {
        toast.error(
          t('Per-token prices need a unique resolution and a positive price')
        )
        return
      }
      perImageBySource[source] = entries
      perSecondBySource[source] = seconds
      perTokenBySource[source] = tokens
      perImageInputBySource[source] = inputPrice
    }
    // The grid layout travels on the gateway row. A blank column label is
    // dropped rather than stored; a duplicate would make two columns read the
    // same cell, so it is refused like a duplicate priced tier.
    const videoResolutions = dialog.video.columns
      .map((column) => column.size.trim())
      .filter(Boolean)
    if (new Set(videoResolutions).size !== videoResolutions.length) {
      toast.error(
        t('Per-second prices need a unique resolution and a positive price')
      )
      return
    }
    const videoGrid =
      (dialogModel && isVideoModel(dialogModel)) ||
      videoResolutions.length > 0 ||
      dialog.video.conditions.length > 0
        ? { conditions: dialog.video.conditions, resolutions: videoResolutions }
        : undefined
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
      const perImage = perImageBySource[source]
      const perSecond = perSecondBySource[source]
      const perToken = perTokenBySource[source]
      const perImageInput = perImageInputBySource[source]
      const hasValue =
        Object.keys(defaultLanes).length > 0 ||
        Object.keys(conditions).length > 0 ||
        perImage.length > 0 ||
        perSecond.length > 0 ||
        perToken.length > 0 ||
        perImageInput !== undefined
      // 清空某来源全部价格时仍要提交该行，让后端把旧值整行覆盖为空
      if (hasValue || existing?.rows[source]) {
        rows.push({
          model_name: modelName,
          source,
          ...defaultLanes,
          ...(Object.keys(conditions).length > 0 ? { conditions } : {}),
          ...(perImage.length > 0 ? { per_image: perImage } : {}),
          ...(perSecond.length > 0 ? { per_second: perSecond } : {}),
          ...(perToken.length > 0 ? { per_token: perToken } : {}),
          ...(perImageInput !== undefined
            ? { per_image_input: perImageInput }
            : {}),
        })
      }
    }
    const gatewayPerImage = perImageBySource.gateway
    const gatewayPerSecond = perSecondBySource.gateway
    const gatewayPerToken = perTokenBySource.gateway
    const gatewayPerImageInput = perImageInputBySource.gateway
    if (
      gatewayPerImage.length > 0 ||
      gatewayPerSecond.length > 0 ||
      gatewayPerToken.length > 0 ||
      gatewayPerImageInput !== undefined ||
      videoGrid ||
      existing?.rows.gateway
    ) {
      rows.push({
        model_name: modelName,
        source: 'gateway',
        ...(gatewayPerImage.length > 0 ? { per_image: gatewayPerImage } : {}),
        ...(gatewayPerSecond.length > 0
          ? { per_second: gatewayPerSecond }
          : {}),
        ...(gatewayPerToken.length > 0 ? { per_token: gatewayPerToken } : {}),
        ...(videoGrid ? { video_grid: videoGrid } : {}),
        ...(gatewayPerImageInput !== undefined
          ? { per_image_input: gatewayPerImageInput }
          : {}),
      })
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
        const {
          conditions,
          per_image,
          per_image_input,
          per_second,
          per_token,
          ...lanes
        } = entry
        rows.push({
          model_name: modelName,
          source,
          ...lanes,
          ...(conditions && Object.keys(conditions).length > 0
            ? { conditions }
            : {}),
          ...(per_image && per_image.length > 0 ? { per_image } : {}),
          ...(per_second && per_second.length > 0 ? { per_second } : {}),
          ...(per_token && per_token.length > 0 ? { per_token } : {}),
          ...(per_image_input !== undefined ? { per_image_input } : {}),
        })
      }
      const gateway = sources.gateway
      if (
        gateway?.per_image?.length ||
        gateway?.per_second?.length ||
        gateway?.per_token?.length ||
        gateway?.video_grid ||
        gateway?.per_image_input !== undefined
      ) {
        rows.push({
          model_name: modelName,
          source: 'gateway',
          ...(gateway.per_image?.length
            ? { per_image: gateway.per_image }
            : {}),
          ...(gateway.per_second?.length
            ? { per_second: gateway.per_second }
            : {}),
          ...(gateway.per_token?.length
            ? { per_token: gateway.per_token }
            : {}),
          ...(gateway.video_grid ? { video_grid: gateway.video_grid } : {}),
          ...(gateway.per_image_input !== undefined
            ? { per_image_input: gateway.per_image_input }
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

  const sourceLabel = (source: ReferencePricingSource) => {
    if (source === 'gateway') return t('Gateway price')
    return source === 'official' ? t('Official API') : 'OpenRouter'
  }

  const conditionCount = (view: ModelRowView): number => {
    const keys = new Set<string>()
    for (const source of SOURCES) {
      for (const key of Object.keys(view.rows[source]?.conditions ?? {})) {
        keys.add(key)
      }
    }
    return keys.size
  }

  const renderSourceMatrix = (source: LaneSource) => {
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
              {/* Per-image prices are what the Image tab and the drawer's
               * /Pic view read; only image models (or a model that already
               * carries such prices) get the matrix. */}
              {((dialogModel && isImageModel(dialogModel)) ||
                dialog.perImage.columns.length > 0 ||
                PER_UNIT_SOURCES.some(
                  (source) => dialog.perImage.inputPrices[source] !== ''
                )) && (
                <PerUnitPriceMatrix
                  columns={dialog.perImage.columns}
                  conditions={[]}
                  cellValue={(source, condition, id) =>
                    dialog.perImage.cells[cellKey(source, condition, id)] ?? ''
                  }
                  onCellChange={(source, condition, id, value) =>
                    setPerImage((prev) => ({
                      ...prev,
                      cells: {
                        ...prev.cells,
                        [cellKey(source, condition, id)]: value,
                      },
                    }))
                  }
                  onAddColumn={() => setPerImage(addColumn)}
                  onRemoveColumn={(id) =>
                    setPerImage((prev) => removeColumn(prev, id))
                  }
                  onColumnLabelChange={(id, value) =>
                    setPerImage((prev) => relabelColumn(prev, id, value))
                  }
                  inputPrices={dialog.perImage.inputPrices}
                  onInputPriceChange={(source, value) =>
                    setPerImage((prev) => ({
                      ...prev,
                      inputPrices: { ...prev.inputPrices, [source]: value },
                    }))
                  }
                  label={t('Per-image prices')}
                  description={`${t(
                    'USD per image by size or quality. The gateway row is the list price at group ratio 1; each tier scales it by its ratio.'
                  )} ${t(
                    'The input image column is the charge per image attached to an edit request.'
                  )}`}
                  addLabel={t('Add size')}
                  tierLabel={t('Size')}
                  removeLabel={t('Remove size')}
                  sourceLabel={sourceLabel}
                  t={t}
                />
              )}
              {/* The video grid is what the Video tab and the drawer's /Sec
               * and /Token views read: one layout of conditions and
               * resolutions, priced per second and per token by every source. */}
              {((dialogModel && isVideoModel(dialogModel)) ||
                dialog.video.columns.length > 0) && (
                <>
                  <div className='flex flex-col gap-2'>
                    <Label>{t('Rate Conditions')}</Label>
                    <ToggleGroup
                      multiple
                      variant='outline'
                      size='sm'
                      spacing={2}
                      className='flex flex-wrap'
                      value={
                        dialog.video.conditions.length > 0
                          ? dialog.video.conditions
                          : [NO_CONDITION_TOGGLE]
                      }
                      onValueChange={(value) => {
                        const chosen = value as string[]
                        setVideo((prev) => {
                          // "None" is exclusive: picking it clears the
                          // conditions, picking a condition drops it.
                          const cleared =
                            chosen.includes(NO_CONDITION_TOGGLE) &&
                            prev.conditions.length > 0
                          return {
                            ...prev,
                            conditions: cleared
                              ? []
                              : VIDEO_RATE_CONDITIONS.filter((condition) =>
                                  chosen.includes(condition)
                                ),
                          }
                        })
                      }}
                      aria-label={t('Rate Conditions')}
                    >
                      <ToggleGroupItem value={NO_CONDITION_TOGGLE}>
                        {t('None')}
                      </ToggleGroupItem>
                      {VIDEO_RATE_CONDITIONS.map((condition) => (
                        <ToggleGroupItem key={condition} value={condition}>
                          {t(VIDEO_RATE_CONDITION_LABELS[condition])}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <p className='text-muted-foreground text-xs'>
                      {t(
                        'Rate conditions the video prices split on; with none selected, each service has one row.'
                      )}
                    </p>
                  </div>
                  <PerUnitPriceMatrix
                    columns={dialog.video.columns}
                    conditions={dialog.video.conditions}
                    cellValue={(source, condition, id) =>
                      dialog.video.perSecond[cellKey(source, condition, id)] ??
                      ''
                    }
                    onCellChange={(source, condition, id, value) =>
                      setVideo((prev) => ({
                        ...prev,
                        perSecond: {
                          ...prev.perSecond,
                          [cellKey(source, condition, id)]: value,
                        },
                      }))
                    }
                    onAddColumn={() => setVideo(addColumn)}
                    onRemoveColumn={(id) =>
                      setVideo((prev) => removeColumn(prev, id))
                    }
                    onColumnLabelChange={(id, value) =>
                      setVideo((prev) => relabelColumn(prev, id, value))
                    }
                    label={t('Per-second prices')}
                    description={t(
                      'USD per second of video by output resolution. The gateway row is the list price at group ratio 1; each tier scales it by its ratio.'
                    )}
                    addLabel={t('Add resolution')}
                    tierLabel={t('Resolution')}
                    removeLabel={t('Remove resolution')}
                    sourceLabel={sourceLabel}
                    t={t}
                  />
                  <PerUnitPriceMatrix
                    columns={dialog.video.columns}
                    conditions={dialog.video.conditions}
                    cellValue={(source, condition, id) =>
                      dialog.video.perToken[cellKey(source, condition, id)] ??
                      ''
                    }
                    onCellChange={(source, condition, id, value) =>
                      setVideo((prev) => ({
                        ...prev,
                        perToken: {
                          ...prev.perToken,
                          [cellKey(source, condition, id)]: value,
                        },
                      }))
                    }
                    onAddColumn={() => setVideo(addColumn)}
                    onRemoveColumn={(id) =>
                      setVideo((prev) => removeColumn(prev, id))
                    }
                    onColumnLabelChange={(id, value) =>
                      setVideo((prev) => relabelColumn(prev, id, value))
                    }
                    action={
                      dialogModel?.video_rates?.length ? (
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={prefillGatewayTokenPrices}
                        >
                          {t('Fill from billing multipliers')}
                        </Button>
                      ) : undefined
                    }
                    label={t('Per-token prices')}
                    description={t(
                      'USD per million tokens by output resolution. The gateway row is the list price at group ratio 1; each tier scales it by its ratio.'
                    )}
                    addLabel={t('Add resolution')}
                    tierLabel={t('Resolution')}
                    removeLabel={t('Remove resolution')}
                    sourceLabel={sourceLabel}
                    t={t}
                  />
                </>
              )}
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
