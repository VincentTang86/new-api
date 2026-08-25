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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  CalendarClock,
  Code2,
  FileText,
  HeartPulse,
  Info,
  Layers,
  Maximize2,
  Sparkles,
  Timer,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { sideDrawerContentClassName } from '@/components/drawer-layout'
import { GroupBadge } from '@/components/group-badge'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getPerfMetrics } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
  getSuccessRateTextClass,
} from '@/features/performance-metrics/lib/format'
import { cn } from '@/lib/utils'

import { parseTags } from '../lib/model-helpers'
import type { ModelCapability, PricingModel, TokenUnit } from '../types'
import { ModelBillingModeBadge } from './model-billing-mode-badge'
import { ModelDetailsApi } from './model-details-api'
import { ModelDetailsPerformance } from './model-details-performance'
import {
  ModelDetailsPricingNotes,
  ModelDetailsPricingTable,
} from './model-details-pricing-table'

// ----------------------------------------------------------------------------
// Local UI helpers
// ----------------------------------------------------------------------------

function SectionTitle(props: { children: React.ReactNode }) {
  return (
    <h2 className='mb-3 text-xs font-semibold tracking-wider text-(--pd-muted-2) uppercase'>
      {props.children}
    </h2>
  )
}

/** Label above a metadata or catalogue value, per the design's small caps. */
function FieldLabel(props: { children: React.ReactNode }) {
  return (
    <span className='text-[10px] font-semibold tracking-wide text-(--pd-faint) uppercase'>
      {props.children}
    </span>
  )
}

const CAPABILITY_LABEL_KEYS: Record<ModelCapability, string> = {
  function_calling: 'Function calling',
  streaming: 'Streaming',
  vision: 'Vision',
  json_mode: 'JSON mode',
  structured_output: 'Structured output',
  reasoning: 'Reasoning',
  tools: 'Tools',
  system_prompt: 'System prompt',
  web_search: 'Web search',
  code_interpreter: 'Code interpreter',
  caching: 'Prompt caching',
  embeddings: 'Embeddings',
}

const MODALITY_LABEL_KEYS: Record<string, string> = {
  text: 'Text',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  file: 'File',
}

const TOKEN_FORMAT = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
})

function formatCatalogTokenCount(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return ''
  if (tokens >= 1_000_000) {
    return `${TOKEN_FORMAT.format(tokens / 1_000_000)}M`
  }
  if (tokens >= 1_000) {
    return `${TOKEN_FORMAT.format(tokens / 1_000)}K`
  }
  return TOKEN_FORMAT.format(tokens)
}

function formatCatalogYearMonth(value?: string): string {
  if (!value) return ''
  const [yearStr, monthStr] = value.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return value
  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short' })
}

function normalizeCatalogItems(items?: readonly string[]): string[] {
  if (!items) return []
  return items.filter((item) => item.trim().length > 0)
}

function OverviewMetric(props: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  valueClassName?: string
}) {
  const Icon = props.icon

  return (
    <div className='flex min-w-0 flex-1 flex-col gap-1 p-2'>
      <div className='truncate text-[9px] font-medium tracking-wider text-(--pd-faint) uppercase'>
        {props.label}
      </div>
      <div className='flex items-center gap-1.5'>
        <Icon className='size-3 shrink-0 text-(--pd-muted)' />
        <span
          className={cn(
            'truncate font-mono text-sm font-semibold tabular-nums text-(--pd-ink)',
            props.valueClassName
          )}
        >
          {props.value}
        </span>
      </div>
    </div>
  )
}

function OverviewSummaryGrid(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const metricsQuery = useQuery({
    queryKey: ['perf-metrics', props.model.model_name],
    queryFn: () => getPerfMetrics(props.model.model_name, 24),
    staleTime: 60 * 1000,
  })

  const groups = metricsQuery.data?.data.groups ?? []
  const successRates = groups
    .map((group) => group.success_rate)
    .filter((rate) => Number.isFinite(rate))
  const successRate =
    successRates.length > 0
      ? successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length
      : Number.NaN
  const tpsValues = groups
    .map((group) => group.avg_tps)
    .filter((value) => value > 0)
  const avgTps =
    tpsValues.length > 0
      ? tpsValues.reduce((sum, value) => sum + value, 0) / tpsValues.length
      : 0
  const latencyValues = groups
    .map((group) => group.avg_latency_ms)
    .filter((value) => value > 0)
  const avgLatency =
    latencyValues.length > 0
      ? Math.round(
          latencyValues.reduce((sum, value) => sum + value, 0) /
            latencyValues.length
        )
      : 0

  return (
    <div className='flex w-full divide-x divide-(--pd-border) border border-(--pd-border) bg-(--pd-surface) max-[480px]:flex-col max-[480px]:divide-x-0 max-[480px]:divide-y'>
      <OverviewMetric
        icon={Timer}
        label='TPS'
        value={formatThroughput(avgTps)}
      />
      <OverviewMetric
        icon={Timer}
        label={t('Avg Completion Time')}
        value={formatLatency(avgLatency)}
      />
      <OverviewMetric
        icon={HeartPulse}
        label={t('Success rate')}
        value={formatUptimePct(successRate)}
        valueClassName={getSuccessRateTextClass(successRate)}
      />
    </div>
  )
}

function CatalogPillList(props: { items: string[] }) {
  return (
    <div className='flex min-w-0 flex-wrap gap-1.5'>
      {props.items.map((item) => (
        <span
          key={item}
          className='rounded-md bg-(--pd-surface-muted) px-2 py-1 text-xs font-medium text-(--pd-muted)'
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function CatalogTextValue(props: { children: React.ReactNode }) {
  return (
    <span className='min-w-0 truncate text-[13px] font-medium text-(--pd-ink)'>
      {props.children}
    </span>
  )
}

function CatalogInfoCell(props: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex min-w-0 flex-col gap-1.5 bg-(--pd-surface) px-3 py-2.5'>
      <FieldLabel>{props.label}</FieldLabel>
      {props.children}
    </div>
  )
}

function ModalityLabels(props: { items: string[] }) {
  const { t } = useTranslation()
  if (props.items.length === 0) return null

  return (
    <span className='inline-flex items-center gap-1 align-middle'>
      {props.items.map((item) => (
        <span key={item} className='font-medium'>
          {t(MODALITY_LABEL_KEYS[item] ?? item)}
        </span>
      ))}
    </span>
  )
}

function ModelBackendQuickStats(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const model = props.model
  const inputModalities = normalizeCatalogItems(model.input_modalities)
  const outputModalities = normalizeCatalogItems(model.output_modalities)
  const contextLength = model.context_length ?? 0
  const maxOutput = model.max_output_tokens ?? 0
  const knowledgeCutoff = formatCatalogYearMonth(model.knowledge_cutoff)
  const releaseDate = formatCatalogYearMonth(model.release_date)

  const stats: {
    key: string
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: React.ReactNode
    hint?: string
  }[] = []

  // Design order: what the model takes in, how much of it fits, when it landed.
  if (inputModalities.length > 0 || outputModalities.length > 0) {
    stats.push({
      key: 'modalities',
      icon: FileText,
      label: t('Modalities'),
      value: (
        <span className='inline-flex items-center gap-1'>
          <ModalityLabels items={inputModalities} />
          {inputModalities.length > 0 && outputModalities.length > 0 && (
            <span className='text-(--pd-faint)'>→</span>
          )}
          <ModalityLabels items={outputModalities} />
        </span>
      ),
    })
  }

  if (contextLength > 0) {
    stats.push({
      key: 'context',
      icon: Layers,
      label: t('Context'),
      value: `${formatCatalogTokenCount(contextLength)} ${t('tokens')}`,
      hint: t('Maximum input window'),
    })
  }

  if (releaseDate) {
    stats.push({
      key: 'release',
      icon: CalendarClock,
      label: t('Released'),
      value: releaseDate,
    })
  }

  if (maxOutput > 0) {
    stats.push({
      key: 'max-output',
      icon: Maximize2,
      label: t('Max output'),
      value: formatCatalogTokenCount(maxOutput),
      hint: t('Maximum tokens per response'),
    })
  }

  if (knowledgeCutoff) {
    stats.push({
      key: 'knowledge',
      icon: Sparkles,
      label: t('Knowledge cutoff'),
      value: knowledgeCutoff,
    })
  }

  // These come from catalogue metadata the backend does not carry yet, so the
  // row disappears rather than rendering a strip of empty cards.
  if (stats.length === 0) return null

  return (
    <div className='flex flex-wrap gap-3'>
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.key}
            className='flex min-w-[160px] flex-1 flex-col gap-2 rounded-[10px] border border-(--pd-border) bg-(--pd-surface-muted) p-3'
          >
            <span className='inline-flex min-w-0 items-center gap-1'>
              <Icon className='size-3 shrink-0 text-(--pd-faint)' />
              <FieldLabel>{stat.label}</FieldLabel>
            </span>
            <span className='truncate text-[13px] font-medium text-(--pd-ink)'>
              {stat.value}
            </span>
            {stat.hint && (
              <span className='truncate text-[10px] text-(--pd-faint)'>
                {stat.hint}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Capabilities only — the modalities live in the metadata card row above, and
 * stating them twice in one drawer reads as two different facts.
 */
function ModelBackendSignalsSection(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const capabilities = normalizeCatalogItems(props.model.capabilities)

  if (capabilities.length === 0) return null

  return (
    <section>
      <SectionTitle>{t('Capabilities')}</SectionTitle>
      <div className='rounded-[10px] border border-(--pd-border) p-3'>
        <CatalogPillList
          items={capabilities.map((capability) =>
            t(
              CAPABILITY_LABEL_KEYS[capability as ModelCapability] ?? capability
            )
          )}
        />
      </div>
    </section>
  )
}

function ModelBackendProviderSection(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const model = props.model
  const groups = normalizeCatalogItems(model.enable_groups)
  const endpoints = normalizeCatalogItems(model.supported_endpoint_types)
  const tags = parseTags(model.tags)
  const cells: React.ReactNode[] = []

  if (model.vendor_name) {
    cells.push(
      <CatalogInfoCell key='provider' label={t('Provider')}>
        <CatalogTextValue>{model.vendor_name}</CatalogTextValue>
      </CatalogInfoCell>
    )
  }

  cells.push(
    <CatalogInfoCell key='type' label={t('Type')}>
      <ModelBillingModeBadge model={model} />
    </CatalogInfoCell>
  )

  if (groups.length > 0) {
    cells.push(
      <CatalogInfoCell key='groups' label={t('Groups')}>
        <CatalogPillList items={groups} />
      </CatalogInfoCell>
    )
  }

  if (endpoints.length > 0) {
    cells.push(
      <CatalogInfoCell key='endpoints' label={t('Endpoints')}>
        <CatalogPillList items={endpoints} />
      </CatalogInfoCell>
    )
  }

  if (tags.length > 0) {
    cells.push(
      <CatalogInfoCell key='tags' label={t('Tags')}>
        <CatalogPillList items={tags} />
      </CatalogInfoCell>
    )
  }

  if (model.parameter_count) {
    cells.push(
      <CatalogInfoCell key='parameters' label={t('Parameters')}>
        <CatalogTextValue>{model.parameter_count}</CatalogTextValue>
      </CatalogInfoCell>
    )
  }

  if (cells.length === 0) return null

  return (
    <section>
      <SectionTitle>{t('Model')}</SectionTitle>
      <div className='grid grid-cols-1 gap-px overflow-hidden rounded-[10px] border border-(--pd-border) bg-(--pd-border) sm:grid-cols-2'>
        {cells}
      </div>
    </section>
  )
}

function ModelBackendDetailsSection(props: { model: PricingModel }) {
  return (
    <>
      <ModelBackendSignalsSection model={props.model} />
      <ModelBackendProviderSection model={props.model} />
    </>
  )
}

// ----------------------------------------------------------------------------
// Model header (always visible above the detail sections)
// ----------------------------------------------------------------------------

function ModelHeader(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const model = props.model
  const description = model.description || model.vendor_description || null

  return (
    <header className='flex flex-col gap-5'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex min-w-0 flex-col gap-1.5'>
          <div className='flex min-w-0 items-center gap-2'>
            <h1 className='min-w-0 font-mono text-[22px] leading-tight font-bold tracking-tight text-(--pd-ink-strong) sm:text-[26px]'>
              {model.model_name}
            </h1>
            <CopyButton
              value={model.model_name || ''}
              className='size-6 shrink-0'
              iconClassName='size-3.5'
              tooltip={t('Copy model name')}
              successTooltip={t('Copied!')}
              aria-label={t('Copy model name')}
            />
          </div>
          {model.vendor_name && (
            <span className='w-fit rounded-full bg-(--pd-accent-bg) px-2.5 py-[3px] text-[11px] font-semibold text-(--pd-primary)'>
              {model.vendor_name}
            </span>
          )}
        </div>
        {/* Trying a model starts with a key, so this lands on the console's
         * API keys page rather than a chat surface. */}
        <Link
          to='/keys'
          className='shrink-0 rounded-lg border border-(--pd-primary)/25 bg-(--pd-accent-bg) px-[18px] py-2.5 text-[13px] font-semibold whitespace-nowrap text-(--pd-primary) transition-colors hover:bg-(--pd-accent-bg-hover)'
        >
          {t('Try this model')}
        </Link>
      </div>
      {description && (
        <p className='pt-2 pb-4 text-[13px] leading-relaxed text-(--pd-muted-2)'>
          {description}
        </p>
      )}
    </header>
  )
}

// ----------------------------------------------------------------------------
// Auto group chain (shown above the pricing table)
// ----------------------------------------------------------------------------

function AutoGroupChain(props: { model: PricingModel; autoGroups: string[] }) {
  const { t } = useTranslation()
  const modelEnableGroups = Array.isArray(props.model.enable_groups)
    ? props.model.enable_groups
    : []
  const autoChain = props.autoGroups.filter((g) =>
    modelEnableGroups.includes(g)
  )

  if (autoChain.length === 0) return null

  return (
    <div className='flex flex-wrap items-center gap-1 text-xs text-(--pd-muted-2)'>
      <span className='font-medium'>{t('Auto Group Chain')}</span>
      <span className='text-(--pd-faint)'>→</span>
      {autoChain.map((g, idx) => (
        <span key={g} className='flex items-center gap-1'>
          <GroupBadge group={g} size='sm' />
          {idx < autoChain.length - 1 && (
            <span className='text-(--pd-faint)'>→</span>
          )}
        </span>
      ))}
    </div>
  )
}

const TAB_VALUES = ['overview', 'performance', 'api'] as const
type TabValue = (typeof TAB_VALUES)[number]

const TAB_META: Record<
  TabValue,
  { icon: React.ComponentType<{ className?: string }>; labelKey: string }
> = {
  overview: { icon: Info, labelKey: 'Overview' },
  performance: { icon: HeartPulse, labelKey: 'Performance' },
  api: { icon: Code2, labelKey: 'API' },
}

export interface ModelDetailsContentProps {
  model: PricingModel
  groupRatio: Record<string, number>
  usableGroup: Record<string, { desc: string; ratio: number }>
  endpointMap: Record<string, { path?: string; method?: string }>
  autoGroups: string[]
  tokenUnit: TokenUnit
}

export function ModelDetailsContent(props: ModelDetailsContentProps) {
  const { t } = useTranslation()

  return (
    <div className='@container/details space-y-2'>
      <ModelHeader model={props.model} />
      <ModelBackendQuickStats model={props.model} />

      {/* The design underlines the selected tab with the brand gradient and
       * spreads the three across the full width. */}
      <Tabs defaultValue='overview' className='gap-4 pt-2'>
        <TabsList
          variant='line'
          className='h-auto w-full gap-0 border-b border-(--pd-border) p-0 group-data-horizontal/tabs:h-auto'
        >
          {TAB_VALUES.map((value) => {
            const Icon = TAB_META[value].icon
            return (
              <TabsTrigger
                key={value}
                value={value}
                className='h-auto min-w-0 flex-1 gap-2 rounded-none py-3.5 text-[15px] font-semibold text-(--pd-faint) after:bg-linear-to-r after:from-(--pd-gradient-from) after:to-(--pd-gradient-to) group-data-horizontal/tabs:after:bottom-0 group-data-horizontal/tabs:after:h-[3px] data-active:font-bold data-active:text-(--pd-primary)'
              >
                <Icon className='size-[18px]' />
                <span className='truncate'>{t(TAB_META[value].labelKey)}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value='overview' className='space-y-6 outline-none'>
          <OverviewSummaryGrid model={props.model} />

          <section className='space-y-2.5'>
            <div>
              <h2 className='text-base font-bold text-(--pd-ink-strong)'>
                {t('Pricing')}
              </h2>
              <p className='text-xs text-(--pd-faint)'>
                {t('Rates for every plan this model is available on.')}
              </p>
            </div>
            <AutoGroupChain model={props.model} autoGroups={props.autoGroups} />
            <ModelDetailsPricingTable
              model={props.model}
              groupRatio={props.groupRatio}
              usableGroup={props.usableGroup}
              tokenUnit={props.tokenUnit}
            />
            <ModelDetailsPricingNotes
              model={props.model}
              tokenUnit={props.tokenUnit}
            />
          </section>

          <ModelBackendDetailsSection model={props.model} />
        </TabsContent>

        <TabsContent value='performance' className='outline-none'>
          <ModelDetailsPerformance model={props.model} />
        </TabsContent>

        <TabsContent value='api' className='outline-none'>
          <ModelDetailsApi
            model={props.model}
            endpointMap={props.endpointMap}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Drawer wrapper
// ----------------------------------------------------------------------------

export interface ModelDetailsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Names the panel for assistive tech; the visible title is in the body. */
  title: string
  children: React.ReactNode
}

/**
 * Model details as the design draws them: a panel that slides in from the right
 * of the catalogue, starting below the sticky public header so the page it
 * belongs to stays visible behind it.
 *
 * Callers keep this mounted and flip `open`. Unmounting it to close skips the
 * exit transition, because the panel has to stay in the tree while it slides
 * away.
 */
export function ModelDetailsDrawer(props: ModelDetailsDrawerProps) {
  const { t } = useTranslation()

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side='right'
        showCloseButton={false}
        overlayClassName='bg-black/30 duration-200 supports-backdrop-filter:backdrop-blur-none'
        // The `sm:` prefix is load-bearing: SheetContent's right-side base
        // carries `sm:max-w-sm`, and tailwind-merge only drops it for an
        // override at the same breakpoint. 90vw at every width keeps the
        // 880px panel off the edge on narrower screens.
        //
        // The design slides the panel in from fully off-screen over 350ms
        // rather than nudging it 2.5rem while fading, so the translate and
        // opacity transition styles are overridden too — `ease-in-out` is
        // already the design's cubic-bezier(0.4, 0, 0.2, 1).
        className={sideDrawerContentClassName(
          'top-[55px] bottom-0 h-auto w-[880px] max-w-[90vw] shadow-[-8px_0_24px_rgba(0,0,0,0.08)] sm:max-w-[90vw] ' +
            'duration-[350ms] data-starting-style:translate-x-full data-ending-style:translate-x-full data-starting-style:opacity-100 data-ending-style:opacity-100 motion-reduce:transition-none'
        )}
      >
        <SheetHeader className='sr-only'>
          <SheetTitle>{props.title}</SheetTitle>
          <SheetDescription>{t('Model details')}</SheetDescription>
        </SheetHeader>
        {/* The design gives the close control its own bar above the content
         * rather than floating it over the model name. */}
        <div className='flex shrink-0 items-center justify-end px-5 py-1.5'>
          <SheetClose
            aria-label={t('Close')}
            className='flex size-8 cursor-pointer items-center justify-center rounded-md text-(--pd-muted-2) transition-colors hover:bg-(--pd-surface-muted)'
          >
            <X className='size-3.5' />
          </SheetClose>
        </div>
        <div className='flex-1 overflow-y-auto px-5 pb-8'>{props.children}</div>
      </SheetContent>
    </Sheet>
  )
}
