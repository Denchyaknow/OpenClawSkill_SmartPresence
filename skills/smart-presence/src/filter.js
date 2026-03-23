const { coerceArray } = require('./utils');

class FilterEngine {
  constructor(config) {
    this.config = config;
    this.lastTriggerTime = 0;
    this.dailyTriggerCount = 0;
    this.lastResetDate = new Date().toDateString();
    this.channelLastTrigger = new Map();
  }

  shouldProcess(message) {
    this.resetDailyCounterIfNeeded();

    if (this.dailyTriggerCount >= this.config.rate_limits.max_daily_triggers) {
      return { pass: false, reason: 'Daily trigger limit reached' };
    }

    if (coerceArray(this.config.filtering.ignore_channels).includes(message.channel_id)) {
      return { pass: false, reason: 'Channel globally ignored' };
    }

    const guild = coerceArray(this.config.guilds).find((entry) => entry.guild_id === message.guild_id);
    if (!guild) {
      return { pass: false, reason: 'Guild not configured' };
    }

    if (!guild.enabled) {
      return { pass: false, reason: 'Guild disabled' };
    }

    const whitelist = coerceArray(guild.channels?.whitelist);
    const blacklist = coerceArray(guild.channels?.blacklist);
    const scanAllIfEmpty = guild.channels?.scan_all_if_empty !== false;

    if (blacklist.includes(message.channel_id)) {
      return { pass: false, reason: 'Channel in blacklist' };
    }

    if (!scanAllIfEmpty || whitelist.length > 0) {
      if (!whitelist.includes(message.channel_id)) {
        return { pass: false, reason: 'Channel not in whitelist' };
      }
    }

    if (this.config.filtering.ignore_bot_messages && message.author_bot) {
      return { pass: false, reason: 'Bot message' };
    }

    const content = (message.content || '').trim();
    if (content.length < this.config.filtering.min_message_length) {
      return { pass: false, reason: 'Message too short' };
    }

    if (coerceArray(this.config.filtering.ignore_users).includes(message.author_id)) {
      return { pass: false, reason: 'User ignored' };
    }

    const now = Date.now();
    const globalSeconds = (now - this.lastTriggerTime) / 1000;
    if (globalSeconds < this.config.rate_limits.min_interval_seconds) {
      return { pass: false, reason: 'Global rate limit' };
    }

    const channelSeconds = (now - (this.channelLastTrigger.get(message.channel_id) || 0)) / 1000;
    if (channelSeconds < this.config.rate_limits.per_channel_min_interval) {
      return { pass: false, reason: 'Channel rate limit' };
    }

    this.lastTriggerTime = now;
    this.channelLastTrigger.set(message.channel_id, now);
    this.dailyTriggerCount += 1;

    return { pass: true };
  }

  resetDailyCounterIfNeeded() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailyTriggerCount = 0;
      this.lastResetDate = today;
    }
  }
}

module.exports = FilterEngine;
