# Changelog

### 31/10/2026
* The README shows how the pane looks, with two illustrations (dark theme while working, light theme once finished)
  drawn with the mod's own bars, icons and texts.
* First public version (0.1.0), published as a GitHub repository that is also a plugin marketplace.

### 30/10/2026
* The mod: a Progress side pane with an overall bar and one bar per task (pending, running, waiting, done, failed),
  animated bars when progress cannot be measured, elapsed times, a "working / waiting for you" line and a live list of
  the tool calls in flight.
* The `mcp__progress-panel__progress` tool (tasks merged by id, `reset`, `remove`) and the `/progress-pane` command.
* The `progress` skill, which tells Claude to keep the pane updated for the rest of the session.
* Tests for the tool and the pane on the terminal, desktop, VS Code and mobile surfaces.
