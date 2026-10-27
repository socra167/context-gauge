# context-gauge

A Claude Code mod that shows how full the current session's context window is, so you know when to run `/compact`.

- Bottom of the prompt: `🟢 Context 42%` (🟢 under 50%, 🟡 50%+, 🔴 75%+)
- Click it to see the exact token counts.
- A one-time alert when the level turns yellow or red; it resets after `/compact`.

Thresholds are `WARN` / `DANGER` at the top of `hooks/register.tsx`.

## Install

At the prompt of a terminal session:

```
/plugin install context-gauge --marketplace socra167/context-gauge
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install context-gauge --marketplace socra167/context-gauge
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `socra167/context-gauge`, then Add plugin.
