const http = require('http');
const https = require('https');
const { truncate, sleep } = require('./utils');

class WebhookClient {
  constructor(config = {}) {
    this.config = config;
    this.url = new URL(config.url || 'http://127.0.0.1:18789/hooks/wake');
  }

  async send(context) {
    if (!this.config.enabled) {
      return { skipped: true, reason: 'Webhook disabled' };
    }

    const payload = {
      text: this.formatContext(context),
      mode: this.config.mode || 'now',
      metadata: {
        skill: 'smart-presence',
        version: context.version || '1.0.0',
        channel_id: context.channel_id,
        channel_name: context.channel_name,
        guild_id: context.guild_id,
        bot_username: context.bot_username,
        bot_id: context.bot_id,
        message_count: context.messages.length,
        timestamp: new Date().toISOString()
      }
    };

    const body = JSON.stringify(payload);
    const options = {
      protocol: this.url.protocol,
      hostname: this.url.hostname,
      port: this.url.port || (this.url.protocol === 'https:' ? 443 : 80),
      path: `${this.url.pathname}${this.url.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: `Bearer ${this.config.token}`
      },
      timeout: this.config.timeout_ms || 10000
    };

    const transport = this.url.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = transport.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk.toString();
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, body: responseBody });
            return;
          }
          reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy(new Error('Request timeout'));
      });

      req.write(body);
      req.end();
    });
  }

  async sendWithRetry(context) {
    const attempts = Math.max(1, this.config.retry_attempts || 3);
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await this.send(context);
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          await sleep(attempt * 1000);
        }
      }
    }

    throw lastError;
  }

  formatContext(context) {
    const lines = [
      '[Smart Presence] Activity detected',
      '',
      `Bot: ${context.bot_username || 'OpenClaw'}`,
      `Channel: #${context.channel_name || 'unknown'} (${context.channel_id})`,
      `Guild: ${context.guild_id || 'unknown'}`,
      '',
      'Recent messages:'
    ];

    context.messages.forEach((message, index) => {
      const timestamp = new Date(message.created_at).toISOString().slice(11, 19);
      lines.push(`${index + 1}. [${timestamp}] ${message.author_name}: ${truncate(message.content, 200)}`);
    });

    lines.push('', 'OpenClaw, analyze and respond if appropriate.');
    return lines.join('\n');
  }
}

module.exports = WebhookClient;
