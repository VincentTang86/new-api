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
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { ApiKey } from '@/features/keys/types'
import { formatQuota } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

const TOKEN_STATUS_ENABLED = 1

interface AccountStatusCardsProps {
  apiKeys: ApiKey[] | undefined
  apiKeysLoading: boolean
}

export function AccountStatusCards({
  apiKeys,
  apiKeysLoading,
}: AccountStatusCardsProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)

  const quota = user?.quota ?? 0
  const activeCount =
    apiKeys?.filter((key) => key.status === TOKEN_STATUS_ENABLED).length ?? 0
  const inactiveCount = (apiKeys?.length ?? 0) - activeCount

  return (
    <div className='grid gap-3 sm:grid-cols-2 sm:gap-4'>
      <div className='bg-card flex flex-col gap-2 rounded-lg border px-4 py-3.5 sm:px-5 sm:py-4'>
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground text-sm font-medium'>
            {t('Credit Balance')}
          </span>
          {quota > 0 && (
            <Badge
              variant='outline'
              className='border-success/30 text-success text-[11px]'
            >
              {t('Available')}
            </Badge>
          )}
        </div>
        <div className='flex items-center gap-3'>
          <span className='text-2xl font-bold tracking-tight'>
            {formatQuota(quota)}
          </span>
          <Button
            type='button'
            size='sm'
            variant='secondary'
            className='h-6 rounded-full px-3 text-xs'
            onClick={() => void navigate({ to: '/wallet' })}
          >
            {t('Add Credits')}
          </Button>
        </div>
      </div>

      <div className='bg-card flex flex-col gap-2 rounded-lg border px-4 py-3.5 sm:px-5 sm:py-4'>
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground text-sm font-medium'>
            {t('API Keys')}
          </span>
          {apiKeysLoading ? (
            <Skeleton className='h-4 w-24' />
          ) : (
            <span className='text-muted-foreground/70 text-xs'>
              {t('{{active}} Active / {{inactive}} Inactive', {
                active: activeCount,
                inactive: inactiveCount,
              })}
            </span>
          )}
        </div>
        <div className='flex items-center gap-3'>
          {apiKeysLoading ? (
            <Skeleton className='h-8 w-10' />
          ) : (
            <span className='text-2xl font-bold tracking-tight'>
              {apiKeys?.length ?? 0}
            </span>
          )}
          <Button
            type='button'
            size='sm'
            variant='link'
            className='h-6 px-0 text-xs'
            onClick={() => void navigate({ to: '/keys' })}
          >
            {t('Manage Keys')}
          </Button>
        </div>
      </div>
    </div>
  )
}
