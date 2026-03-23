const fs = require('fs');
const path = require('path');
const { coerceArray, readJson } = require('./utils');

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }

  const config = readJson(configPath);
  validateConfig(config);
  return config;
}

function validateConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Config must be a JSON object');
  }

  requireBoolean(config, 'enabled', errors);
  requireObject(config, 'buffer', errors);
  requireObject(config, 'filtering', errors);
  requireObject(config, 'rate_limits', errors);
  requireObject(config, 'webhook', errors);
  requireObject(config, 'logging', errors);

  requireNumber(config.buffer, 'max_messages_per_channel', errors, 1);
  requireNumber(config.buffer, 'expiration_minutes', errors, 1);
  requireNumber(config.buffer, 'context_messages_to_send', errors, 1);
  requireNumber(config.buffer, 'deduplication_window', errors, 1);

  requireBoolean(config.filtering, 'ignore_bot_messages', errors);
  requireNumber(config.filtering, 'min_message_length', errors, 0);
  requireArray(config.filtering, 'ignore_users', errors);
  requireArray(config.filtering, 'ignore_channels', errors);

  requireNumber(config.rate_limits, 'min_interval_seconds', errors, 0);
  requireNumber(config.rate_limits, 'max_daily_triggers', errors, 1);
  requireNumber(config.rate_limits, 'per_channel_min_interval', errors, 0);

  requireBoolean(config.webhook, 'enabled', errors);
  requireString(config.webhook, 'url', errors);
  requireString(config.webhook, 'token', errors);
  requireString(config.webhook, 'mode', errors);
  requireNumber(config.webhook, 'retry_attempts', errors, 1);
  requireNumber(config.webhook, 'timeout_ms', errors, 1);

  requireArray(config, 'guilds', errors);
  coerceArray(config.guilds).forEach((guild, index) => validateGuild(guild, index, errors));

  if (errors.length > 0) {
    throw new Error(`Invalid config:\n- ${errors.join('\n- ')}`);
  }
}

function validateGuild(guild, index, errors) {
  const prefix = `guilds[${index}]`;
  if (!guild || typeof guild !== 'object' || Array.isArray(guild)) {
    errors.push(`${prefix} must be an object`);
    return;
  }

  requireString(guild, 'guild_id', errors, prefix);
  requireBoolean(guild, 'enabled', errors, prefix);

  if (!guild.channels || typeof guild.channels !== 'object' || Array.isArray(guild.channels)) {
    errors.push(`${prefix}.channels must be an object`);
    return;
  }

  requireArray(guild.channels, 'whitelist', errors, `${prefix}.channels`);
  requireArray(guild.channels, 'blacklist', errors, `${prefix}.channels`);
  requireBoolean(guild.channels, 'scan_all_if_empty', errors, `${prefix}.channels`);
}

function requireObject(obj, key, errors, prefix = '') {
  const value = obj?.[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(formatPath(prefix, key) + ' must be an object');
  }
}

function requireArray(obj, key, errors, prefix = '') {
  if (!Array.isArray(obj?.[key])) {
    errors.push(formatPath(prefix, key) + ' must be an array');
  }
}

function requireBoolean(obj, key, errors, prefix = '') {
  if (typeof obj?.[key] !== 'boolean') {
    errors.push(formatPath(prefix, key) + ' must be a boolean');
  }
}

function requireString(obj, key, errors, prefix = '') {
  if (typeof obj?.[key] !== 'string' || obj[key].trim() === '') {
    errors.push(formatPath(prefix, key) + ' must be a non-empty string');
  }
}

function requireNumber(obj, key, errors, min = 0, prefix = '') {
  if (typeof obj?.[key] !== 'number' || Number.isNaN(obj[key]) || obj[key] < min) {
    errors.push(formatPath(prefix, key) + ` must be a number >= ${min}`);
  }
}

function formatPath(prefix, key) {
  return prefix ? `${prefix}.${key}` : key;
}

module.exports = {
  loadConfig,
  validateConfig
};
