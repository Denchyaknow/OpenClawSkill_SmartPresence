const fs = require('fs');
const path = require('path');
const DiscrawlManager = require('./discrawl');
const MessageBuffer = require('./buffer');
const FilterEngine = require('./filter');
const WebhookClient = require('./webhook');
const Logger = require('./logger');
const { loadConfig } = require('./config');
const { getBotInfo } = require('./bot-info');
const { getDiscordBrowserPaths, INSTALL_COMMAND, resolveSkillDir, resolveWorkspaceDir } = require('./utils');

class SmartPresenceSkill {
  constructor(options = {}) {
    const baseDir = options.baseDir || __dirname;
    this.workspaceDir = options.workspaceDir || resolveWorkspaceDir(baseDir);
    this.skillDir = options.skillDir || resolveSkillDir(baseDir);
    this.configPath = options.configPath || path.join(this.skillDir, 'config', 'smart-presence.json');
    this.logger = options.logger || null;
    this.config = null;
    this.buffer = null;
    this.filter = null;
    this.webhook = null;
    this.discrawl = null;
    this.botInfo = null;
    this.running = false;
    this.stopping = false;
  }

  async start() {
    this.config = loadConfig(this.configPath);
    this.logger = this.logger || new Logger(this.config.logging, this.skillDir);

    if (!this.config.enabled) {
      this.logger.info('Smart Presence disabled in config; exiting without starting Discrawl');
      return;
    }

    this.logger.info('Smart Presence starting');

    const dependencyPaths = getDiscordBrowserPaths(this.workspaceDir, this.config);
    if (!fs.existsSync(dependencyPaths.executablePath)) {
      this.logger.error('DiscordBrowser skill not found');
      this.logger.error(`Please install: ${dependencyPaths.installCommand || INSTALL_COMMAND}`);
      const error = new Error('DiscordBrowser dependency missing');
      error.exitCode = 1;
      throw error;
    }

    this.logger.info(`Found DiscordBrowser Discrawl at ${dependencyPaths.executablePath}`);

    this.botInfo = await getBotInfo(this.workspaceDir, this.config, this.logger);
    this.buffer = new MessageBuffer(
      this.config.buffer.max_messages_per_channel,
      this.config.buffer.expiration_minutes,
      this.config.buffer.deduplication_window
    );
    this.filter = new FilterEngine(this.config);
    this.webhook = new WebhookClient(this.config.webhook);
    this.discrawl = new DiscrawlManager({
      executablePath: dependencyPaths.executablePath,
      workspaceDir: this.workspaceDir,
      maxRestartAttempts: 3,
      restartDelayMs: 5000
    });

    this.discrawl.on('message', (message) => {
      this.handleMessage(message).catch((error) => this.logger.error('Error handling message', error));
    });
    this.discrawl.on('debug', (line) => this.logger.debug(`Discrawl: ${line}`));
    this.discrawl.on('close', (code, signal) => {
      this.logger.warn(`Discrawl exited with code ${code} signal ${signal || 'none'}`);
    });
    this.discrawl.on('error', (error) => {
      this.logger.error('Discrawl error', error);
      if (!this.stopping && /too many times/i.test(error.message)) {
        this.stop().catch((stopError) => this.logger.error('Error stopping after Discrawl crash', stopError));
      }
    });

    await this.discrawl.start();
    this.running = true;
    this.logger.info('Smart Presence started successfully');
  }

  async handleMessage(message) {
    if (!this.running) {
      return;
    }

    const wasAdded = this.buffer.add(message);
    if (!wasAdded) {
      this.logger.debug(`Skipped duplicate message ${message.id}`);
      return;
    }

    const result = this.filter.shouldProcess(message);
    if (!result.pass) {
      this.logger.debug(`Filtered message ${message.id}: ${result.reason}`);
      return;
    }

    const context = {
      version: this.config.version,
      channel_id: message.channel_id,
      channel_name: message.channel_name || 'unknown',
      guild_id: message.guild_id || 'unknown',
      bot_username: this.botInfo.username,
      bot_id: this.botInfo.id,
      messages: this.buffer.getContext(message.channel_id, this.config.buffer.context_messages_to_send)
    };

    const response = await this.webhook.sendWithRetry(context);
    this.logger.info(`Forwarded ${context.messages.length} messages from channel ${context.channel_id} (${response.status || 'skipped'})`);
  }

  async stop() {
    if (this.stopping) {
      return;
    }

    this.stopping = true;
    this.running = false;

    if (this.logger) {
      this.logger.info('Stopping Smart Presence');
    }

    if (this.discrawl) {
      await this.discrawl.stop();
    }

    if (this.logger) {
      this.logger.info('Smart Presence stopped');
    }
  }
}

async function main() {
  const skill = new SmartPresenceSkill();

  process.on('SIGINT', async () => {
    await skill.stop();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await skill.stop();
    process.exit(0);
  });

  try {
    await skill.start();
  } catch (error) {
    console.error(error.message);
    process.exit(error.exitCode || 1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  SmartPresenceSkill
};
