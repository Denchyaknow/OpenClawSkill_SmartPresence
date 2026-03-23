# OpenClaw notes used for this skill

These notes summarize the relevant OpenClaw documentation I checked while building Smart Presence.

## Skills loading and install locations

- OpenClaw treats `./skills` in the active workspace as the highest-precedence skill location.
- Managed user overrides can live in `~/.openclaw/skills/<name>/`.
- Additional skill directories can be configured with `skills.load.extraDirs`.
- `clawhub` installs into `./skills` by default, which makes a dedicated `skills/smart-presence/` folder a natural layout.

## Linux installation note

- On Linux, OpenClaw skills can be installed or updated with `openclaw skills ...` commands, while `clawhub` remains the publishing/sync tool.

## Webhook assumptions

- OpenClaw exposes `POST /hooks/wake` with payload `{ text, mode? }`.
- Hook auth accepts `Authorization: Bearer <token>`.
- The default local Gateway examples use `http://127.0.0.1:18789/hooks/...`.

## Implication for Smart Presence

- Smart Presence should stay as a standalone workspace skill.
- It can wake OpenClaw without patching core code by calling `/hooks/wake`.
- The token should match the Gateway `hooks.token` value in `~/.openclaw/openclaw.json`.
