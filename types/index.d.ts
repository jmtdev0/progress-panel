export type TaskStatus = 'pending' | 'running' | 'waiting' | 'done' | 'failed'

export type Task = {
  id: string
  label: string
  // 0-100, or null when the progress cannot be measured (drawn as an animated bar)
  percent: number | null
  status: TaskStatus
  detail?: string
  startedAt?: number
  endedAt?: number
}

export type Board = { title: string; tasks: Task[]; updatedAt: number }

export type LiveCall = { id: string; tool: string; summary: string; startedAt: number }

declare module 'claude-code' {
  interface PluginState {
    'progress-panel': {
      board: Shaped<Board>
      live: Shaped<LiveCall[]>
      busy: boolean
      tick: number
    }
  }
}
