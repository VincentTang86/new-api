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
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'

/**
 * Opens the details drawer on a model, for the catalogue rows that link into
 * it.
 *
 * Split from `useModelDetailsDrawer` because it must not read the search
 * param: every row in the table calls this, and subscribing would re-render
 * all of them on the very click that starts the drawer's slide-in, spending
 * the frames the animation needs.
 */
export function useOpenModelDetails() {
  const navigate = useNavigate()

  return useCallback(
    (modelId: string) => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          model: modelId,
        }),
        // Only the drawer opens — the catalogue behind it must not jump to
        // the top (router navigations reset scroll by default).
        resetScroll: false,
      })
    },
    [navigate]
  )
}

/**
 * Which model the details drawer is showing, carried in the `model` search
 * param so the drawer survives a reload and can be linked to.
 *
 * Deliberately route-agnostic: the same pricing table renders on `/` and on
 * `/pricing`, and both routes declare the param. Opening pushes so the
 * browser's Back closes the drawer; closing replaces so Back does not
 * immediately re-open it.
 */
export function useModelDetailsDrawer() {
  const navigate = useNavigate()
  const model = useSearch({
    strict: false,
    select: (search) => (search as { model?: string }).model,
  })

  const closeModel = useCallback(() => {
    void navigate({
      to: '.',
      search: ({ model: _open, ...rest }: Record<string, unknown>) => rest,
      replace: true,
      resetScroll: false,
    })
  }, [navigate])

  return {
    modelId: typeof model === 'string' && model.length > 0 ? model : null,
    closeModel,
  }
}
