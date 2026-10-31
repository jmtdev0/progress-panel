---
name: progress
description: Show the work in progress as progress bars in the Progress side pane and keep them updated while working. Use when the person runs this skill or asks to see, visualize or follow the progress of what Claude is doing.
---

# Progress bars in the side pane

The person wants to follow your work visually. The `progress-panel` mod draws a **Progress** pane beside the chat
and gives you the tool `mcp__progress-panel__progress` to fill it. From now on, for the rest of this session, keep
that pane up to date. (The pane also lists, by itself, each tool call while it runs: you do not need to report those.)

## How to use the tool

- **Start of a piece of work:** call it with `reset: true`, a short `title` and one task per step you plan,
  all `pending` except the first, which is `running`. Use stable ids (`build`, `tests`, `docs`...).
- **As you go:** call it again whenever a step starts, finishes, fails or makes measurable progress. Send only the
  tasks that changed; they are merged by id.
- **Percent:** give a real number when you can measure it (steps done out of total, files processed, tests passed,
  pages read). Use `null` when you cannot: the pane shows an animated bar instead. Never invent precision.
- **Waiting:** use `status: "waiting"` (with a `detail` saying on what) while blocked on the person, a long build,
  a background command or a subagent.
- **Long steps:** for a step that runs a while (a build, a loop over many files), update its percent at sensible
  points, roughly every few tool calls, not after every single one.
- **Finishing:** mark each step `done` or `failed`. At the end of the work every task should be `done` or `failed`.
- When the plan changes, add, relabel or `remove` tasks so the pane always matches what you are really doing.

Keep labels to a few words, in the language the person uses with you. Do not mention the tool calls in your replies
unless asked; the pane speaks for itself.

## If the tool is missing

If `mcp__progress-panel__progress` is not among your tools, the mod is not loaded in this session: tell the person
in one line, and carry on with the work without the pane.
