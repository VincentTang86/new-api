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
import axios, { type AxiosRequestConfig } from 'axios'
import i18next, { t } from 'i18next'
import { toast } from 'sonner'

import { toIntlLocale } from '@/i18n/languages'
import {
  applyAuthRotation,
  clearAuthentication,
  refreshAuthentication,
} from '@/lib/auth-session'
import { getServerErrorMessageKey } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipBusinessError?: boolean
    skipErrorHandler?: boolean
    disableDuplicate?: boolean
    skipAuthRefresh?: boolean
    authRetry?: boolean
    acceptAuthRotation?: boolean
  }
}

export type ApiRequestConfig = AxiosRequestConfig

export const api = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: {
    'Cache-Control': 'no-store',
  },
})

// Concurrent 401s share one refresh, but each rejection lands in its own
// interceptor run. A stable id collapses them into a single toast.
const SESSION_EXPIRED_TOAST_ID = 'auth-session-expired'

function businessErrorToastId(message: string): string {
  return `api-error:${message}`
}

const inFlightGet = new Map<string, Promise<unknown>>()
const originalGet = api.get.bind(api)

api.get = ((url: string, config: ApiRequestConfig = {}) => {
  if (config.disableDuplicate) return originalGet(url, config)

  const params = config.params ? JSON.stringify(config.params) : '{}'
  const sessionSID = useAuthStore.getState().auth.session?.sid || 'anonymous'
  const key = `${sessionSID}:${url}?${params}`
  const existingRequest = inFlightGet.get(key)
  if (existingRequest) return existingRequest

  const request = originalGet(url, config).finally(() => {
    inFlightGet.delete(key)
  })
  inFlightGet.set(key, request)
  return request
}) as typeof api.get

function redirectToSignIn(): void {
  if (
    typeof window !== 'undefined' &&
    window.location.pathname !== '/sign-in'
  ) {
    window.location.replace('/sign-in')
  }
}

api.interceptors.response.use(
  (response) => {
    if (response.config.acceptAuthRotation && response.data?.success === true) {
      applyAuthRotation(response.data.data)
    }

    if (
      !response.config.skipBusinessError &&
      typeof response.data?.success === 'boolean' &&
      !response.data.success
    ) {
      const messageKey = getServerErrorMessageKey(response.data)
      const message = messageKey
        ? t(messageKey)
        : response.data.message || t('Request failed')
      // Parallel queries that fail the same way should read as one problem,
      // not a stack of identical toasts. Distinct messages still stack.
      toast.error(message, { id: businessErrorToastId(message) })
    }
    return response
  },
  async (error) => {
    const config = error?.config as ApiRequestConfig | undefined
    const skipErrorHandler = config?.skipErrorHandler
    const status = error?.response?.status

    if (status === 401) {
      // Signing out clears the store before React unmounts the authenticated
      // tree, so its queries refetch once without a token. Those 401s are the
      // expected outcome of a sign-out the user just asked for: the session is
      // already gone and the sign-out flow owns the navigation, so stay quiet.
      const hadSession = Boolean(useAuthStore.getState().auth.user)
      const notifyExpired = hadSession && !skipErrorHandler

      if (config && !config.skipAuthRefresh && !config.authRetry) {
        config.authRetry = true
        const outcome = await refreshAuthentication()
        if (outcome.kind === 'authenticated') {
          const token = useAuthStore.getState().auth.accessToken
          if (token) {
            config.headers = {
              ...config.headers,
              Authorization: `Bearer ${token}`,
            }
          }
          return api.request(config)
        }

        if (outcome.kind === 'anonymous' || outcome.kind === 'out_of_sync') {
          if (notifyExpired) {
            toast.error(t('Session expired!'), { id: SESSION_EXPIRED_TOAST_ID })
          }
          if (hadSession) redirectToSignIn()
        }
      } else if (config?.authRetry) {
        clearAuthentication(false)
        if (notifyExpired) {
          toast.error(t('Session expired!'), { id: SESSION_EXPIRED_TOAST_ID })
        }
        if (hadSession) redirectToSignIn()
      } else if (notifyExpired) {
        toast.error(t('Session expired!'), { id: SESSION_EXPIRED_TOAST_ID })
      }
    } else if (!skipErrorHandler) {
      const messageKey = getServerErrorMessageKey(error)
      const message = messageKey
        ? t(messageKey)
        : error?.response?.data?.message ||
          error?.message ||
          t('Request failed')
      toast.error(message, { id: businessErrorToastId(message) })
    }
    throw error
  }
)

api.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().auth.accessToken
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  // Backend i18n — API error messages and the verification / password-reset
  // emails — reads Accept-Language. The value the browser sends on its own is
  // the OS locale, not the language the visitor picked in the UI, so send the
  // active interface language as a BCP-47 tag instead.
  const locale = toIntlLocale(i18next.language)
  if (locale) {
    config.headers['Accept-Language'] = locale
  }
  return config
})
