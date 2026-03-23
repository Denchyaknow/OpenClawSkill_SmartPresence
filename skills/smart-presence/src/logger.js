const fs = require('fs');
const path = require('path');
const { ensureDirectory } = require('./utils');

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

class Logger {
  constructor(config = {}, skillDir) {
    this.config = {
      level: config.level || 'info',
      file: config.file || 'smart-presence.log',
      max_size_mb: config.max_size_mb || 10,
      max_files: config.max_files || 5,
      console: config.console !== false
    };
    this.skillDir = skillDir;
    this.logsDir = path.join(skillDir, 'logs');
    ensureDirectory(this.logsDir);
    this.logPath = path.join(this.logsDir, this.config.file);
  }

  shouldLog(level) {
    return LEVELS[level] >= LEVELS[this.config.level];
  }

  debug(...args) {
    this.write('debug', args);
  }

  info(...args) {
    this.write('info', args);
  }

  warn(...args) {
    this.write('warn', args);
  }

  error(...args) {
    this.write('error', args);
  }

  write(level, args) {
    if (!this.shouldLog(level)) {
      return;
    }

    this.rotateIfNeeded();

    const message = args
      .map((value) => (value instanceof Error ? value.stack || value.message : this.serialize(value)))
      .join(' ');
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;

    fs.appendFileSync(this.logPath, `${line}\n`);

    if (this.config.console) {
      const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      method(line);
    }
  }

  serialize(value) {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  rotateIfNeeded() {
    if (!fs.existsSync(this.logPath)) {
      return;
    }

    const stat = fs.statSync(this.logPath);
    if (stat.size < this.config.max_size_mb * 1024 * 1024) {
      return;
    }

    const maxFiles = Math.max(1, this.config.max_files);
    for (let index = maxFiles - 1; index >= 1; index -= 1) {
      const source = `${this.logPath}.${index}`;
      const target = `${this.logPath}.${index + 1}`;
      if (fs.existsSync(source)) {
        if (index + 1 > maxFiles) {
          fs.rmSync(source, { force: true });
        } else {
          fs.renameSync(source, target);
        }
      }
    }

    fs.renameSync(this.logPath, `${this.logPath}.1`);
  }
}

module.exports = Logger;
