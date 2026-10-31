# progress-panel

A [Claude Code](https://claude.com/claude-code) mod that adds a **Progress** pane beside the chat, with progress bars
for what Claude is doing, plus a skill that tells Claude to keep those bars up to date while it works.

Run the skill at the start of a task and Claude splits the work into steps, shows them as bars in the pane and moves
them as each step starts, advances, waits or finishes.

## What the pane shows

- Whether Claude is **working** or **waiting for you**.
- An **overall bar** and **one bar per task**, with a status icon (pending, running, waiting, done, failed), the time
  it has been running and an optional note such as `12/40 files`.
- An **animated bar** when progress cannot be measured. Claude is told never to invent a percentage.
- **Running now**: every tool call while it is in flight (a command, a file read, a search...), with its elapsed time.
  This list fills itself; Claude does not have to report it.

## Install

At the prompt of a terminal session:

```
/plugin install progress-panel --marketplace jmtdev0/progress-panel
```

From a shell:

```
claude plugin install progress-panel --marketplace jmtdev0/progress-panel
```

In the Claude desktop app (Code tab), where `/plugin` does not run: click **+** next to the prompt box, then
**Plugins**, **Add marketplace** with `jmtdev0/progress-panel`, then **Add plugin**.

## Use

- `/progress-panel:progress` runs the skill. From then on, for the rest of the session, Claude keeps the pane updated.
  You can also just ask for it ("show me the progress", "I want to see progress bars").
- `/progress-pane` opens the pane by hand; `/progress-pane clear` empties it.

Behind the scenes the mod gives Claude one tool, `mcp__progress-panel__progress`. Tasks are merged by id, so Claude
only sends what changed:

```json
{
  "title": "Release 0.3.0",
  "reset": true,
  "tasks": [
    { "id": "build", "label": "Build the APK", "status": "running", "percent": 40 },
    { "id": "tests", "label": "Run the tests", "status": "pending" }
  ]
}
```

`status` is one of `pending`, `running`, `waiting`, `done` or `failed`; `percent` is 0-100 or `null`; `remove` drops
tasks by id.

## Requirements and limits

- Claude Code with function-hook mods: the terminal, the Code tab of the Claude desktop app or the IDE extensions.
  It does not run in the regular chat on claude.ai.
- The mod API is in early access and may change between Claude Code releases; an update may need a new version of
  this mod.
- The mod only draws the pane, registers the tool and the `/progress-pane` command, and watches tool calls to list
  the ones in flight. It reads no files, runs no commands and makes no network requests.

## Development

`hooks/register.tsx` is the mod, `skills/progress/SKILL.md` the skill, `types/index.d.ts` the state contract and
`tests/progress.test.tsx` the tests.

```
claude plugin validate .
claude plugin test .
```

## License

MIT, see [LICENSE](LICENSE).
