import { create } from 'zustand'
import type { TtsVoice } from './api/speech.js'
import { normalizeLocation, type UserLocation } from './location.js'

export type Locale = 'zh-CN' | 'en-US'

/** 主题偏好；默认跟随系统 */
export type ThemePreference = 'light' | 'dark' | 'system'

/** 思考强度（reasoning_effort）；low / high / max，max 为最大思考强度 */
export type ThinkingEffort = 'low' | 'high' | 'max'

/** 自定义单价（元 / 百万 Token）；无法从服务端获取实时价格时手动输入 */
export type PricePerMillion = { input: number; output: number }

/** 内置默认单价（元 / 百万 Token）：deepseek-flash 缓存未命中的输入价与输出价 */
export const DEFAULT_PRICE: PricePerMillion = { input: 1, output: 2 }

/** 缓存命中输入按输入单价的 10% 计费，与 DeepSeek 定价一致 */
export const CACHE_READ_DISCOUNT = 0.1

/** 本机设置，存 localStorage：API Key、语言、主题、位置、朗读音色、深度思考与智能搜索开关、思考强度、费用展示、侧边栏收起状态 */
type Settings = {
  apiKey: string | null
  locale: Locale
  themePreference: ThemePreference
  location: UserLocation | null
  ttsVoice: TtsVoice
  thinking: boolean
  /** 深度思考开启时的思考强度 */
  thinkingEffort: ThinkingEffort
  search: boolean
  /** 是否在回答下方展示本次消耗的费用估算 */
  showCost: boolean
  /** 每百万 Token 的自定义单价；未填写时为 null，按内置默认价计算 */
  price: PricePerMillion | null
  siderCollapsed: boolean
}

const KEYS = {
  apiKey: 'chat-demo:api-key',
  locale: 'chat-demo:locale',
  location: 'chat-demo:location',
  themePreference: 'chat-demo:theme-preference',
  ttsVoice: 'chat-demo:tts-voice',
  thinking: 'chat-demo:thinking',
  thinkingEffort: 'chat-demo:thinking-effort',
  search: 'chat-demo:search',
  showCost: 'chat-demo:show-cost',
  price: 'chat-demo:price',
  siderCollapsed: 'chat-demo:sider-collapsed',
} as const

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // 存储不可用时只在内存中生效
  }
}

/** 位置选择模式跟随浏览器语言，与应用内选择的界面语言无关。 */
export const isChineseBrowser = (): boolean =>
  (typeof navigator === 'undefined' ? 'zh' : navigator.language).toLowerCase().startsWith('zh')

const initialLocale = (): Locale => {
  const saved = read(KEYS.locale)
  if (saved === 'zh-CN' || saved === 'en-US') {
    return saved
  }
  return isChineseBrowser() ? 'zh-CN' : 'en-US'
}

const initialLocation = (): UserLocation | null => {
  try {
    const location = normalizeLocation(JSON.parse(read(KEYS.location) ?? 'null'))
    if (!location) {
      return null
    }
    return isChineseBrowser()
      ? location.region === 'CN' && location.province
        ? location
        : null
      : { region: location.region }
  } catch {
    return null
  }
}

/** 未保存过时跟随系统 */
const initialThemePreference = (): ThemePreference => {
  const saved = read(KEYS.themePreference)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

/** 未保存过时使用服务端默认音色 stella（海星） */
const initialTtsVoice = (): TtsVoice => (read(KEYS.ttsVoice) === 'tide' ? 'tide' : 'stella')

/** 未保存过时默认最大思考强度 */
const initialThinkingEffort = (): ThinkingEffort => {
  const saved = read(KEYS.thinkingEffort)
  return saved === 'low' || saved === 'high' ? saved : 'max'
}

/** 费用展示：未保存过时默认开启 */
const initialShowCost = (): boolean => read(KEYS.showCost) !== 'false'

/** 自定义单价；非法或缺失时为 null，按内置默认价计算 */
const initialPrice = (): PricePerMillion | null => {
  try {
    const parsed: unknown = JSON.parse(read(KEYS.price) ?? 'null')
    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }
    const { input, output } = parsed as Partial<PricePerMillion>
    if (
      typeof input === 'number' &&
      typeof output === 'number' &&
      Number.isFinite(input) &&
      Number.isFinite(output) &&
      input >= 0 &&
      output >= 0
    ) {
      return { input, output }
    }
    return null
  } catch {
    return null
  }
}

export const useSettings = create<Settings>(() => ({
  apiKey: read(KEYS.apiKey),
  locale: initialLocale(),
  location: initialLocation(),
  themePreference: initialThemePreference(),
  ttsVoice: initialTtsVoice(),
  thinking: read(KEYS.thinking) === 'true',
  thinkingEffort: initialThinkingEffort(),
  search: read(KEYS.search) === 'true',
  showCost: initialShowCost(),
  price: initialPrice(),
  siderCollapsed: read(KEYS.siderCollapsed) === 'true',
}))

export const setLocale = (locale: Locale) => {
  write(KEYS.locale, locale)
  useSettings.setState({ locale })
}

export const setLocation = (value: UserLocation | null) => {
  const location = normalizeLocation(value)
  write(KEYS.location, location ? JSON.stringify(location) : null)
  useSettings.setState({ location })
}

export const setThemePreference = (themePreference: ThemePreference) => {
  write(KEYS.themePreference, themePreference)
  useSettings.setState({ themePreference })
}

export const setTtsVoice = (ttsVoice: TtsVoice) => {
  write(KEYS.ttsVoice, ttsVoice)
  useSettings.setState({ ttsVoice })
}

export const setApiKey = (apiKey: string | null) => {
  write(KEYS.apiKey, apiKey)
  useSettings.setState({ apiKey })
}

export const setThinking = (thinking: boolean) => {
  write(KEYS.thinking, String(thinking))
  useSettings.setState({ thinking })
}

export const setThinkingEffort = (thinkingEffort: ThinkingEffort) => {
  write(KEYS.thinkingEffort, thinkingEffort)
  useSettings.setState({ thinkingEffort })
}

export const setShowCost = (showCost: boolean) => {
  write(KEYS.showCost, String(showCost))
  useSettings.setState({ showCost })
}

export const setPrice = (price: PricePerMillion | null) => {
  write(KEYS.price, price ? JSON.stringify(price) : null)
  useSettings.setState({ price })
}

export const setSearch = (search: boolean) => {
  write(KEYS.search, String(search))
  useSettings.setState({ search })
}

export const setSiderCollapsed = (siderCollapsed: boolean) => {
  write(KEYS.siderCollapsed, String(siderCollapsed))
  useSettings.setState({ siderCollapsed })
}
