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
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import resourcesToBackend from 'i18next-resources-to-backend'
import { initReactI18next } from 'react-i18next'

import { convertDetectedLanguage } from './languages'

/**
 * One dynamic import per locale so each dictionary becomes its own lazy chunk.
 * The seven dictionaries together are ~3 MB — statically importing them put
 * all of that into the entry bundle; now a visitor downloads only the active
 * language (plus the English fallback when they differ).
 */
const localeLoaders: Record<
  string,
  () => Promise<{ default: { translation: Record<string, string> } }>
> = {
  en: () => import('./locales/en.json'),
  zhCN: () => import('./locales/zh.json'),
  fr: () => import('./locales/fr.json'),
  ru: () => import('./locales/ru.json'),
  ja: () => import('./locales/ja.json'),
  vi: () => import('./locales/vi.json'),
  zhTW: () => import('./locales/zh-TW.json'),
}

i18n
  .use(LanguageDetector)
  .use(
    resourcesToBackend(async (language: string) => {
      const load = localeLoaders[language]
      if (!load) throw new Error(`Unsupported locale: ${language}`)
      const dictionary = (await load()).default.translation
      // The plugin unwraps `data.default || data` for ESM interop, and our
      // dictionaries contain a literal "default" key that the unwrap would
      // mistake for a module default export. Hand it a real default-export
      // shape so the unwrap lands on the dictionary itself.
      return { default: dictionary }
    })
  )
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'zhCN', 'fr', 'ru', 'ja', 'vi', 'zhTW'],
    load: 'currentOnly',
    nsSeparator: false, // Allow literal colons in keys (e.g., URLs, labels)
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    react: {
      // Keys are the English source strings, so rendering before the
      // dictionary chunk arrives already shows correct English copy; a
      // Suspense boundary would only trade that for a blank frame. Components
      // re-render when the load completes.
      useSuspense: false,
    },
    detection: {
      // First visits land on English regardless of the browser locale (product
      // requirement), so `navigator` is deliberately absent: only an explicit
      // choice persisted in localStorage picks a language, everything else
      // falls back to `fallbackLng`.
      order: ['localStorage'],
      caches: ['localStorage'],
      // localStorage may still hold `zh-CN`/`zh-TW` style values written by
      // older builds; map them onto our `zhCN`/`zhTW` codes (non-Chinese codes
      // pass through for normal supportedLngs matching).
      convertDetectedLanguage,
    },
  })

export default i18n
