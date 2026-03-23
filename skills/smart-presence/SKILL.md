---
name: smart-presence
description: Monitor Discord activity for OpenClaw by tailing DiscordBrowser's Discrawl stream, buffering recent channel context, filtering/rate-limiting events, and POSTing webhook wake requests to OpenClaw. Use when OpenClaw should observe Discord channels passively and decide for itself when to respond, or when setting up an always-on Discord presence skill that must hard-depend on the DiscordBrowser skill.
---

# Smart Presence

Keep OpenClaw quietly aware of Discord activity without modifying OpenClaw core code.

## Workflow

1. Load `config/smart-presence.json` and validate required fields.
2. Resolve the workspace root from this skill folder.
3. Verify `skills/DiscordBrowser/Crawlie/discrawl.exe` exists.
4. Exit with code `1` and log the install command if DiscordBrowser is missing.
5. Resolve bot identity from the DiscordBrowser SQLite database when possible.
6. Spawn `discrawl.exe tail` from the workspace root.
7. Parse JSON lines, buffer recent channel messages, and deduplicate near-duplicates.
8. Apply guild/channel filters and global/per-channel rate limits.
9. POST the selected context to OpenClaw's `/hooks/wake` endpoint.
10. Stop cleanly on `SIGINT`/`SIGTERM` by terminating the Discrawl child process.

## Non-negotiable rules

- Depend on DiscordBrowser. Do not implement a custom Discord Gateway client.
- Keep the skill isolated under `skills/smart-presence/`; do not edit OpenClaw core files.
- Do nothing when `enabled` is `false`.
- Fail fast when DiscordBrowser is absent and print this install command:

```bash
npx clawhub install https://github.com/Denchyaknow/OpenClawSkill_DiscordBrowser
```

## Files

- `src/index.js`: lifecycle orchestration.
- `src/discrawl.js`: Discrawl child-process manager with capped restart attempts.
- `src/buffer.js`: per-channel ring buffer with expiration and deduplication.
- `src/filter.js`: guild/channel filtering and rate-limit decisions.
- `src/webhook.js`: `/hooks/wake` client with retry/backoff.
- `src/bot-info.js`: DiscordBrowser database lookup with fallback identity.
- `src/config.js`: config loading and structural validation.
- `README.md`: user-facing setup and operations guide.
- `references/openclaw-notes.md`: concise notes from relevant OpenClaw docs.

## References

Read `references/openclaw-notes.md` when you need the exact assumptions this skill makes about OpenClaw skill loading, workspace precedence, and webhook auth/paths.
