import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Board, LiveCall, Task, TaskStatus } from '../types'

const PANE = 'progress'
const PANE_TITLE = 'Progress'
const TOOL_NAME = 'progress'
const TOOL = `mcp__progress-panel__${TOOL_NAME}`
const STATUSES: readonly TaskStatus[] = ['pending', 'running', 'waiting', 'done', 'failed']

// Change a tag when the shape of its value changes: an older value is then read as the initial one.
const board = atom(
  { plugin: 'progress-panel', key: 'board' } as const,
  { title: '', tasks: [], updatedAt: 0 } as Board,
  { shape: 'board-1' },
)
const live = atom({ plugin: 'progress-panel', key: 'live' } as const, [] as LiveCall[], {
  shape: 'live-1',
})
const busy = atom({ plugin: 'progress-panel', key: 'busy' } as const, false)
const tick = atom({ plugin: 'progress-panel', key: 'tick' } as const, 0)

const TOOL_DESCRIPTION = [
  'Updates the Progress side pane the person watches while you work.',
  'Send the tasks you are working on or waiting for, each with a stable id. Tasks are merged by id:',
  'only the fields you send change. Use percent 0-100 when you can measure it (steps done, files',
  'processed, tests passed), or null when you cannot (the pane then shows an animated bar).',
  'status: pending | running | waiting (blocked on the person, a build, a subagent...) | done | failed.',
  'reset: true replaces the whole list (start of a new piece of work). remove drops tasks by id.',
].join(' ')

const INPUT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'What the whole piece of work is, shown on top' },
    reset: { type: 'boolean', description: 'Replace every task with the ones given' },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string', description: 'Short, a few words' },
          percent: { type: ['number', 'null'], minimum: 0, maximum: 100 },
          status: { type: 'string', enum: STATUSES },
          detail: { type: 'string', description: 'Optional one-line note, e.g. "12/40 files"' },
        },
        required: ['id'],
      },
    },
    remove: { type: 'array', items: { type: 'string' } },
  },
}

type TaskPatch = {
  id: string
  label?: string
  percent?: number | null
  status?: TaskStatus
  detail?: string
}

type ProgressInput = { title?: string; reset?: boolean; tasks?: TaskPatch[]; remove?: string[] }

function clampPercent(value: unknown): number | null | undefined {
  if (value === null) return null
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined

  return Math.max(0, Math.min(100, Math.round(value)))
}

function readInput(raw: Record<string, unknown>): ProgressInput {
  const tasks = Array.isArray(raw.tasks) ? raw.tasks : []

  return {
    title: typeof raw.title === 'string' ? raw.title : undefined,
    reset: raw.reset === true,
    remove: Array.isArray(raw.remove) ? raw.remove.filter((id): id is string => typeof id === 'string') : [],
    tasks: tasks.flatMap((item): TaskPatch[] => {
      if (typeof item !== 'object' || item === null) return []
      const one = item as Record<string, unknown>
      if (typeof one.id !== 'string' || one.id === '') return []
      const status = STATUSES.find(s => s === one.status)

      return [
        {
          id: one.id,
          label: typeof one.label === 'string' ? one.label : undefined,
          percent: clampPercent(one.percent),
          status,
          detail: typeof one.detail === 'string' ? one.detail : undefined,
        },
      ]
    }),
  }
}

function applyPatch(previous: Task | undefined, patch: TaskPatch, now: number): Task {
  const status = patch.status ?? previous?.status ?? 'running'
  let percent = patch.percent !== undefined ? patch.percent : (previous?.percent ?? null)
  if (status === 'done') percent = 100
  const wasActive = previous?.status === 'running' || previous?.status === 'waiting'
  const isActive = status === 'running' || status === 'waiting'
  const isFinished = status === 'done' || status === 'failed'

  return {
    id: patch.id,
    label: patch.label ?? previous?.label ?? patch.id,
    percent,
    status,
    detail: patch.detail ?? previous?.detail,
    startedAt: isActive && !wasActive && !previous?.startedAt ? now : previous?.startedAt,
    endedAt: isFinished ? (previous?.endedAt ?? now) : undefined,
  }
}

function overallPercent(tasks: readonly Task[]): number | null {
  if (tasks.length === 0) return null
  const sum = tasks.reduce((total, task) => {
    if (task.status === 'done') return total + 100
    if (task.status === 'pending') return total

    return total + (task.percent ?? 0)
  }, 0)

  return Math.round(sum / tasks.length)
}

function summarize(input: Record<string, unknown>, tool: string): string {
  const pick = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : '')
  const text =
    pick('description') ||
    pick('file_path').split(/[\\/]/).pop() ||
    pick('pattern') ||
    pick('command') ||
    pick('url') ||
    pick('prompt')

  const shortTool = tool.startsWith('mcp__') ? (tool.split('__').pop() ?? tool) : tool
  const oneLine = text.replace(/\s+/g, ' ').trim()

  return oneLine ? `${shortTool}: ${oneLine.slice(0, 60)}` : shortTool
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`

  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

function bar(percent: number | null, width: number, frame: number): string {
  if (percent === null) {
    // Indeterminate: a short block that sweeps along the track.
    const size = Math.max(2, Math.floor(width / 5))
    const span = width + size
    const start = (frame % span) - size

    return Array.from({ length: width }, (_, i) => (i >= start && i < start + size ? '█' : '░')).join('')
  }
  const filled = Math.round((percent / 100) * width)

  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const STATUS_LOOK: Record<TaskStatus, { icon: string; color: string }> = {
  pending: { icon: '○', color: 'subtle' },
  running: { icon: '▶', color: 'claude' },
  waiting: { icon: '⏸', color: 'warning' },
  done: { icon: '✓', color: 'success' },
  failed: { icon: '✗', color: 'error' },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: TOOL_NAME,
      description: TOOL_DESCRIPTION,
      inputSchema: INPUT_SCHEMA,
      isDeferred: false,
    })
    await $.command.register({
      name: 'progress-pane',
      description: 'Open the Progress pane (or clear it with "clear")',
    })

    // Animates the indeterminate bars and the elapsed times while something is moving.
    $.clock.every(1000, async () => {
      const [calls, current] = await Promise.all([read($, live), read($, board)])
      const isMoving =
        calls.length > 0 || current.tasks.some(task => task.status === 'running' || task.status === 'waiting')
      if (isMoving) await update($, tick, n => (n ?? 0) + 1)
    })

    return next(e)
  })

  on('command.run', { command: 'progress-pane' }, async ($, e) => {
    if (e.args.trim() === 'clear') {
      await update($, board, () => ({ title: '', tasks: [], updatedAt: 0 }))
      await update($, live, () => [])
    }
    await $.ui.open({ id: PANE, title: PANE_TITLE })

    return { text: e.args.trim() === 'clear' ? 'Progress pane cleared.' : 'Progress pane opened.' }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const input = readInput(e as unknown as Record<string, unknown>)
    const now = await $.clock.now()
    const next = await update($, board, current => {
      const removed = new Set(input.remove)
      const kept = input.reset ? [] : current.tasks.filter(task => !removed.has(task.id))
      const byId = new Map(kept.map(task => [task.id, task]))
      const previous = input.reset ? new Map(current.tasks.map(task => [task.id, task])) : byId
      for (const patch of input.tasks ?? []) {
        byId.set(patch.id, applyPatch(previous.get(patch.id), patch, now))
      }

      return { title: input.title ?? (input.reset ? '' : current.title), tasks: [...byId.values()], updatedAt: now }
    })
    void $.ui.open({ id: PANE, title: PANE_TITLE })
    const overall = overallPercent(next.tasks)

    return {
      result: `Progress pane updated: ${next.tasks.length} task(s)${overall === null ? '' : `, ${overall}% overall`}.`,
    }
  })

  // Every other tool call shows in the "Running now" list while it is in flight.
  on('tool.call', async ($, e, next) => {
    if (e.tool === TOOL) return next(e)
    const call: LiveCall = {
      id: e.tool_use_id,
      tool: e.tool,
      summary: summarize(e as unknown as Record<string, unknown>, e.tool),
      startedAt: await $.clock.now(),
    }
    await update($, live, list => [...list.filter(one => one.id !== call.id), call].slice(-20))
    try {
      return await next(e)
    } finally {
      await update($, live, list => list.filter(one => one.id !== call.id))
    }
  })

  on('turn.start', async ($, e, next) => {
    await update($, busy, () => true)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await update($, busy, () => false)
    await update($, live, () => [])

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const [current, calls, isBusy, frame, now] = await Promise.all([
      read($, board),
      read($, live),
      read($, busy),
      read($, tick),
      $.clock.now(),
    ])
    const columns = e.props.bodyColumns ?? e.viewport?.columns ?? 40
    const width = Math.max(10, Math.min(40, columns - 8))
    const overall = overallPercent(current.tasks)

    return (
      <Box flexDirection="column">
        <Text color={isBusy ? 'claude' : 'subtle'} weight="semibold">
          {isBusy ? '● Claude is working' : '○ Waiting for you'}
        </Text>

        {current.tasks.length === 0 && calls.length === 0 && (
          <Text dimColor>Nothing to show yet. Run the progress skill and Claude will fill this in.</Text>
        )}

        {current.tasks.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text weight="bold" size="heading">
              {current.title || 'Progress'}
            </Text>
            {overall !== null && (
              <Text mono tabular>
                <Text color={overall === 100 ? 'success' : 'claude'}>{bar(overall, width, frame)}</Text> {overall}%
              </Text>
            )}
            {current.tasks.map(task => {
              const look = STATUS_LOOK[task.status]
              const isActive = task.status === 'running' || task.status === 'waiting'
              const shown = task.status === 'pending' ? 0 : task.percent
              const elapsed =
                task.startedAt !== undefined ? formatElapsed((task.endedAt ?? now) - task.startedAt) : ''

              return (
                <Box flexDirection="column" marginTop={1}>
                  <Text>
                    <Text color={look.color}>{look.icon}</Text> {task.label}
                    {elapsed && <Text dimColor> · {elapsed}</Text>}
                  </Text>
                  <Text mono tabular dimColor={!isActive}>
                    <Text color={look.color}>{bar(isActive ? shown : (shown ?? 0), width, frame)}</Text>{' '}
                    {shown === null ? (isActive ? '…' : '') : `${shown}%`}
                  </Text>
                  {task.detail && <Text dimColor>{task.detail}</Text>}
                </Box>
              )
            })}
          </Box>
        )}

        {calls.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text weight="semibold" dimColor>
              Running now
            </Text>
            {calls.map(call => (
              <Text>
                <Text color="claude">{bar(null, 6, frame)}</Text> {call.summary}
                <Text dimColor> · {formatElapsed(now - call.startedAt)}</Text>
              </Text>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}
