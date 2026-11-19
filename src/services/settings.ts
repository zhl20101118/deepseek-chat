import { create } from 'zustand'
import type { TtsVoice } from './api/speech.js'
import { normalizeLocation, type UserLocation } from './location.js'

export type Locale = 'zh-CN' | 'en-US'

/** 主题偏好；默认跟随系统 */
export type ThemePreference = 'light' | 'dark' | 'system'

/** 思考强度（reasoning_effort）；low / high / max，max 为最大思考强度 */
export type ThinkingEffort = 'low' | 'high' | 'max'

/** 对话模式：普通沿用原样，oi 面向信息学竞赛；这里存新会话的默认值，每个会话自己记一份 */
export type ChatMode = 'normal' | 'oi'

/** 自定义单价（元 / 百万 Token）；无法从服务端获取实时价格时手动输入 */
export type PricePerMillion = { input: number; output: number }

/** 内置默认单价（元 / 百万 Token）：deepseek-flash 高峰时段的输入价与输出价 */
export const DEFAULT_PRICE: PricePerMillion = { input: 2, output: 8 }

/** 缓存命中的输入按输入单价的 2% 计费（官方：高峰 0.04 元 vs 未命中 2 元） */
export const CACHE_READ_DISCOUNT = 0.02

/** 空闲时段为高峰时段的一半 */
export const VALLEY_DISCOUNT = 0.5

/** 高峰时段（北京时间，分钟数）：周一至周五 9:00-12:00、14:00-18:00；周末与法定节假日全天空闲 */
const PEAK_WINDOWS: { start: number; end: number }[] = [
  { start: 9 * 60, end: 12 * 60 },
  { start: 14 * 60, end: 18 * 60 },
]

/** 是否落在空闲时段：按北京时间判定，周末全天算空闲（法定节假日数据拿不到，按工作日处理） */
export const isValleyTime = (time: number): boolean => {
  const beijing = new Date(time + 8 * 60 * 60 * 1000)
  const day = beijing.getUTCDay()
  if (day === 0 || day === 6) {
    return true
  }
  const minutes = beijing.getUTCHours() * 60 + beijing.getUTCMinutes()
  return PEAK_WINDOWS.every(({ start, end }) => minutes < start || minutes >= end)
}

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
  /** 新会话默认使用的对话模式；已有会话各自记 mode */
  mode: ChatMode
  /** 双模式开关；关闭后隐藏模式切换，所有对话按普通模式回复 */
  dualMode: boolean
  search: boolean
  /** 是否在回答下方展示本次消耗的费用估算 */
  showCost: boolean
  /** 费用估算是否按峰谷时段计价（空闲时段按高峰价的 5 折） */
  peakValley: boolean
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
  mode: 'chat-demo:mode',
  dualMode: 'chat-demo:dual-mode',
  search: 'chat-demo:search',
  showCost: 'chat-demo:show-cost',
  peakValley: 'chat-demo:peak-valley',
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

/** 未保存过时默认高思考强度；low / high / max 都会被记住 */
const initialThinkingEffort = (): ThinkingEffort => {
  const saved = read(KEYS.thinkingEffort)
  return saved === 'low' || saved === 'max' ? saved : 'high'
}

/** 未保存过时默认普通模式 */
const initialMode = (): ChatMode => (read(KEYS.mode) === 'oi' ? 'oi' : 'normal')

/** 双模式：未保存过时默认开启，关闭后只剩普通模式 */
const initialDualMode = (): boolean => read(KEYS.dualMode) !== 'false'

/** 费用展示：未保存过时默认开启 */
const initialShowCost = (): boolean => read(KEYS.showCost) !== 'false'

/** 峰谷定价：未保存过时默认开启，估算结果更贴近实际扣费 */
const initialPeakValley = (): boolean => read(KEYS.peakValley) !== 'false'

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
  mode: initialMode(),
  dualMode: initialDualMode(),
  search: read(KEYS.search) === 'true',
  showCost: initialShowCost(),
  peakValley: initialPeakValley(),
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

/** 记住模式，下一个新会话沿用 */
export const setMode = (mode: ChatMode) => {
  write(KEYS.mode, mode)
  useSettings.setState({ mode })
}

/** 关闭双模式后输入区不再显示模式切换，请求也一律走普通提示词 */
export const setDualMode = (dualMode: boolean) => {
  write(KEYS.dualMode, String(dualMode))
  useSettings.setState({ dualMode })
}

export const setShowCost = (showCost: boolean) => {
  write(KEYS.showCost, String(showCost))
  useSettings.setState({ showCost })
}

export const setPeakValley = (peakValley: boolean) => {
  write(KEYS.peakValley, String(peakValley))
  useSettings.setState({ peakValley })
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
