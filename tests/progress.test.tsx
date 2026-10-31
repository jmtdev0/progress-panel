import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'progress-panel',
  component: 'Pane',
  requestId: 'progress',
  props: {
    title: 'Progress',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const TOOL = 'mcp__progress-panel__progress'

test('the tool fills the pane and merges tasks by id, on every surface', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  on('tool.register', () => ({ value: { tool: TOOL } }))
  on('command.register', () => ({ value: { command: 'progress-pane' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const first = await $.tool.call({
    tool: TOOL,
    reset: true,
    title: 'Release 0.3.0',
    tasks: [
      { id: 'build', label: 'Build the APK', status: 'running', percent: 40 },
      { id: 'tests', label: 'Run the tests', status: 'pending' },
    ],
  })
  expect(String(first.result)).toContain('2 task(s), 20% overall')

  const second = await $.tool.call({
    tool: TOOL,
    tasks: [
      { id: 'build', status: 'done' },
      { id: 'tests', status: 'running', percent: null, detail: 'unittest' },
    ],
  })
  expect(String(second.result)).toContain('2 task(s), 50% overall')

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Release 0\.3\.0/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /Build the APK/ }))?.text).toContain('✓')
    expect(await ui.find({ type: 'Text', text: /100%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /unittest/ })).toBeDefined()
    await ui.unmount()
  }
})

test('reset replaces the list and remove drops a task', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  on('tool.register', () => ({ value: { tool: TOOL } }))
  on('command.register', () => ({ value: { command: 'progress-pane' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: TOOL, reset: true, tasks: [{ id: 'a', label: 'Old work' }] })
  await $.tool.call({ tool: TOOL, reset: true, tasks: [{ id: 'b', label: 'New work' }, { id: 'c', label: 'Extra' }] })
  const result = await $.tool.call({ tool: TOOL, remove: ['c'] })
  expect(String(result.result)).toContain('1 task(s)')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /New work/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Old work/ })).toBeUndefined()
  await ui.unmount()
})

test('an empty pane says how to fill it', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Run the progress skill/ })).toBeDefined()
  await ui.unmount()
})
