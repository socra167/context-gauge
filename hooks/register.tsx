import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage } from 'claude-code'

import type { Fill } from '../types'

const fill = atom({ plugin: 'context-gauge', key: 'fill' } as const, null)
// 마지막으로 알림을 띄운 단계 (0: 없음, 1: 주의, 2: 위험). 같은 단계에서 반복 알림하지 않는다.
const warnedLevel = atom({ plugin: 'context-gauge', key: 'warnedLevel' } as const, 0)

// 이 비율(%)부터 노랑(주의) / 빨강(compact 권장)
const WARN = 50
const DANGER = 75

const levelOf = (percent: number) => (percent >= DANGER ? 2 : percent >= WARN ? 1 : 0)

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : `${n}`)

const toFill = (c: SessionContextUsage): Fill | null =>
  c.tokens === undefined
    ? null
    : { tokens: c.tokens, window: c.window, percent: c.percent ?? Math.round((c.tokens / c.window) * 100) }

const lightOf = (percent: number) => {
  const level = levelOf(percent)
  return level === 2 ? '🔴' : level === 1 ? '🟡' : '🟢'
}

// 하단 표시: 🟢 Context 42% (클릭 시 세부 토큰 알림)
const shortLine = (f: Fill) => `${lightOf(f.percent)} Context ${f.percent}%`

// 클릭 시 보여줄 세부 내용
const detailLine = (f: Fill) => {
  const level = levelOf(f.percent)
  const advice = level === 2 ? '/compact recommended.' : level === 1 ? 'Consider /compact soon.' : 'Plenty of room left.'
  return `Context ${f.percent}% used: ${f.tokens.toLocaleString('en-US')} / ${f.window.toLocaleString('en-US')} tokens (${fmt(f.window - f.tokens)} left). ${advice}`
}

const refresh = async ($: EngineInterface, c: SessionContextUsage) => {
  const next = toFill(c)
  await update($, fill, () => next)
  if (next === null) return

  const level = levelOf(next.percent)
  const warned = await read($, warnedLevel)
  if (level > warned) {
    $.ui.toast(
      level === 2
        ? `Context is ${next.percent}% full. Running /compact is recommended.`
        : `Context is ${next.percent}% full. Consider running /compact soon.`,
    )
  }
  // 단계가 내려가면(/compact 후) 다시 알릴 수 있게 맞춰 둔다.
  if (level !== warned) await update($, warnedLevel, () => level)
}

const safeRefresh = async ($: EngineInterface, where: string, get: () => Promise<SessionContextUsage>) => {
  try {
    await refresh($, await get())
  } catch (err) {
    $.ui.toast(`Context gauge error (${where}): ${String(err)}`)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    // 이전 버전이 열어 둔 사이드 패널 정리
    void $.ui.close({ id: 'context-gauge' }).catch(() => undefined)
    // 이전 버전이 띄운 상태줄 정리 (표시는 하단 모드 자리의 클릭 항목만 사용)
    $.ui.status(undefined)
    await safeRefresh($, 'start', async () => (await $.session.usage()).context)
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) await safeRefresh($, 'measure', async () => e.context)
    return next(e)
  })

  // 측정 이벤트를 놓친 경우 대비: 턴이 끝날 때마다 직접 다시 읽는다.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await safeRefresh($, 'turn end', async () => (await $.session.usage()).context)
    return result
  })

  // 입력창 하단 오른쪽 모드 표시 자리: 기존 모드 뒤에 클릭 가능한 'Context %' 를 붙인다.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const f = await read($, fill)
    if (f === null) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const modes = e.props.modes

    return (
      <Box>
        {modes.length > 0 ? <Text dimColor>{modes.join(' & ')} · </Text> : null}
        <Button key="context-gauge" plain onPress={() => $.ui.toast(detailLine(f))}>
          {shortLine(f)}
        </Button>
      </Box>
    )
  })
}
