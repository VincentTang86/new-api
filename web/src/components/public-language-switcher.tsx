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
import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useChangeLanguage } from '@/hooks/use-change-language'
import {
  INTERFACE_LANGUAGE_OPTIONS,
  normalizeInterfaceLanguage,
} from '@/i18n/languages'
import { cn } from '@/lib/utils'

/**
 * Public-header language menu from the marketing design: a globe icon plus the
 * short language badge (EN / 简 / …) that opens the full language list. The
 * console keeps its own icon-only `LanguageSwitcher`.
 */
export function PublicLanguageSwitcher(props: { className?: string }) {
  const { i18n, t } = useTranslation()
  const handleChangeLanguage = useChangeLanguage()
  const currentLanguage = normalizeInterfaceLanguage(i18n.language)
  const current =
    INTERFACE_LANGUAGE_OPTIONS.find((lang) => lang.code === currentLanguage) ??
    INTERFACE_LANGUAGE_OPTIONS[0]

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <button
            type='button'
            className={cn(
              'flex cursor-pointer items-center gap-1.5 text-sm font-medium text-(--pd-ink) transition-colors hover:text-(--pd-primary)',
              props.className
            )}
            aria-label={t('Change language')}
          />
        }
      >
        <Globe className='size-4' aria-hidden='true' />
        <span className='whitespace-nowrap'>{current.short}</span>
      </DropdownMenuTrigger>
      {/* The menu renders in a portal, outside the `.public-design` shell, so
       * it has to re-open that scope or every `--pd-*` token resolves to
       * nothing and the design's palette silently falls back to the console's.
       */}
      <DropdownMenuContent
        align='end'
        sideOffset={10}
        className='public-design w-40 rounded-[10px] border border-(--pd-border) bg-(--pd-surface) p-0 py-1.5 shadow-[0px_10px_24px_rgba(0,0,0,0.12)] ring-0'
      >
        {INTERFACE_LANGUAGE_OPTIONS.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChangeLanguage(lang.code)}
            className={cn(
              'cursor-pointer rounded-none px-4 py-2 focus:bg-(--pd-surface-muted)',
              lang.code === currentLanguage
                ? 'font-semibold text-(--pd-primary) focus:text-(--pd-primary)'
                : 'text-(--pd-ink) focus:text-(--pd-ink)'
            )}
          >
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
