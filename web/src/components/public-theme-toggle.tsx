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
import { Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/context/theme-provider'
import { cn } from '@/lib/utils'

/**
 * Public-header theme control from the marketing design: a single sun/moon
 * button that flips the resolved theme. Until the visitor clicks, the theme
 * stays on the provider default (`system`, following `prefers-color-scheme`).
 * The console keeps its three-state `ThemeSwitch`.
 */
export function PublicThemeToggle(props: { className?: string }) {
  const { t } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()

  /* Keep the browser chrome color in sync, matching ThemeSwitch. */
  useEffect(() => {
    const themeColor = resolvedTheme === 'dark' ? '#020817' : '#fff'
    const metaThemeColor = document.querySelector("meta[name='theme-color']")
    if (metaThemeColor) metaThemeColor.setAttribute('content', themeColor)
  }, [resolvedTheme])

  return (
    <button
      type='button'
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label={t('Toggle theme')}
      className={cn(
        'cursor-pointer text-(--pd-muted-2) transition-colors hover:text-(--pd-primary)',
        props.className
      )}
    >
      {resolvedTheme === 'dark' ? (
        <Moon className='size-5' strokeWidth={1.5} aria-hidden='true' />
      ) : (
        <Sun className='size-5' strokeWidth={1.5} aria-hidden='true' />
      )}
    </button>
  )
}
