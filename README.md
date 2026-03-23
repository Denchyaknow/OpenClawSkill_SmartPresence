# Smart Presence

Smart Presence is an OpenClaw skill that listens to Discord activity through the **DiscordBrowser** skill's `discrawl tail` stream, buffers recent context, applies filters/rate limits, and wakes OpenClaw through a webhook when activity looks worth reviewing.

## Hard dependency

This skill **requires** DiscordBrowser. It does not implement its own Discord Gateway client.

Install DiscordBrowser first:

```bash
npx clawhub install https://github.com/Denchyaknow/OpenClawSkill_DiscordBrowser
```

If `skills/DiscordBrowser/Crawlie/discrawl.exe` is missing, Smart Presence logs an error and exits with code `1`.

## File layout

```text
skills/smart-presence/
├── SKILL.md
├── README.md
├── package.json
├── config/
│   └── smart-presence.json
├── src/
│   ├── index.js
│   ├── config.js
│   ├── bot-info.js
│   ├── discrawl.js
│   ├── buffer.js
│   ├── filter.js
│   ├── webhook.js
│   ├── logger.js
│   └── utils.js
├── references/
│   └── openclaw-notes.md
└── logs/
```

## How it works

1. Load and validate `config/smart-presence.json`.
2. Resolve the workspace root from the skill's location.
3. Verify DiscordBrowser exists at `skills/DiscordBrowser/Crawlie/discrawl.exe`.
4. Detect bot information from DiscordBrowser's SQLite database when available.
5. Spawn `discrawl.exe tail` in the workspace root.
6. Parse JSON lines from stdout.
7. Add messages to an in-memory per-channel ring buffer.
8. Run guild/channel filters and rate limits.
9. Send a `POST` request to OpenClaw at `/hooks/wake`.
10. Shut down cleanly by terminating the child process.

## Configuration

Edit `config/smart-presence.json`.

Key settings:

- `enabled`: master toggle.
- `guilds`: guild/channel allowlists and blocklists.
- `buffer`: how much recent channel context to keep and forward.
- `filtering`: ignored users/channels and minimum message length.
- `rate_limits`: cooldowns and daily cap.
- `webhook`: OpenClaw webhook URL/token/retry policy.
- `logging`: file and console logging behavior.

### Example OpenClaw hook configuration

Add or merge this into `~/.openclaw/openclaw.json`:

```json
{
  "hooks": {
    "enabled": true,
    "token": "smart-presence-token",
    "path": "/hooks"
  }
}
```

### Start locally

```bash
cd skills/smart-presence
npm install
npm start
```

## Runtime behavior

- **Skill disabled:** exits quietly after logging that the skill is disabled.
- **DiscordBrowser missing:** logs the install command and exits with code `1`.
- **Discrawl crash:** retries automatically up to 3 times with a 5 second delay.
- **Webhook failure:** retries with linear backoff and logs the final failure.
- **Database unavailable:** falls back to a generic `OpenClaw` bot identity.

## Message format sent to OpenClaw

```text
[Smart Presence] Activity detected

Bot: OpenClaw
Channel: #bot-spam (818828164251516958)
Guild: 794700691490078740

Recent messages:
1. [02:30:15] Dencho: Hello?
2. [02:30:22] Jindatesha: Hey there
3. [02:30:45] Dencho: Anyone know how to code?

OpenClaw, analyze and respond if appropriate.
```
