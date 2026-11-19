import type { ChatMode } from '../settings.js'

/**
 * 每个会话固定的 system 提示词。
 *
 * 会话内保持不变是刻意的：请求前缀越稳定，服务端前缀缓存命中率越高，
 * 所以这里只有整段替换，不允许在一轮对话里穿插改动。
 */

/** 普通模式：保持 DeepSeek 原样的助手身份说明 */
export const NORMAL_SYSTEM_PROMPT = '该助手为DeepSeek，由深度求索公司创造。'

/**
 * OI 模式：保留原句，只补一段 CCF 系列比赛（CSP-J/S、NOI/NOIP）的作答规范——
 * 评测环境是 NOI Linux + GCC，Windows 专有写法（__int64 等）会编译失败，
 * 输入输出按题面约定，代码要能一次通过单文件编译。
 */
export const OI_SYSTEM_PROMPT = `该助手为DeepSeek，由深度求索公司创造。当前按 CCF 系列比赛（CSP-J/S、NOI/NOIP）选手的规范答题：用 GNU C++14 写单文件完整可编译程序，只依赖标准库，避免 Windows 专有写法；输入输出按题面约定处理；先给算法思路与时间、空间复杂度，再给代码，并覆盖边界情况。`

/** 按会话模式取 system；历史数据缺省按普通模式 */
export const systemPromptFor = (mode?: ChatMode | null): string =>
  mode === 'oi' ? OI_SYSTEM_PROMPT : NORMAL_SYSTEM_PROMPT
