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

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ModelNameProps {
  /** Row label: the model's display name when one is configured, else its id. */
  name: string
  className?: string
}

/**
 * The Model column's label, shared by every pricing list so the catalogue, the
 * home preview and the phone layouts read the same.
 *
 * A display name may carry line breaks the admin typed, and those are the whole
 * point of configuring one, so a name with a newline is laid out as written.
 * Everything else — model ids above all — keeps the column's truncation, and
 * only reveals the full text in a tooltip when the column actually cuts it:
 * whether it does depends on the viewport the column share resolves against, so
 * it is measured when the tooltip would open rather than once on mount.
 */
export function ModelName(props: ModelNameProps) {
  const nameRef = useRef<HTMLSpanElement>(null)
  const [showFullName, setShowFullName] = useState(false)

  if (props.name.includes('\n')) {
    return (
      <span className={cn('whitespace-pre-line break-words', props.className)}>
        {props.name}
      </span>
    )
  }

  return (
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
            <span ref={nameRef} className={cn('truncate', props.className)} />
          }
        >
          {props.name}
        </TooltipTrigger>
        <TooltipContent className='font-mono'>{props.name}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
