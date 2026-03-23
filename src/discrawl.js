const { spawn } = require('child_process');
const { EventEmitter } = require('events');

class DiscrawlManager extends EventEmitter {
  constructor(options) {
    super();
    this.executablePath = options.executablePath;
    this.workspaceDir = options.workspaceDir;
    this.maxRestartAttempts = options.maxRestartAttempts || 3;
    this.restartDelayMs = options.restartDelayMs || 5000;
    this.process = null;
    this.stdoutBuffer = '';
    this.stopped = false;
    this.restartAttempts = 0;
  }

  async start() {
    this.stopped = false;
    return this.spawnProcess();
  }

  async spawnProcess() {
    return new Promise((resolve, reject) => {
      let settled = false;

      try {
        this.process = spawn(this.executablePath, ['tail'], {
          cwd: this.workspaceDir,
          stdio: ['ignore', 'pipe', 'pipe']
        });
      } catch (error) {
        reject(error);
        return;
      }

      this.process.stdout.on('data', (chunk) => {
        this.stdoutBuffer += chunk.toString();
        const lines = this.stdoutBuffer.split(/\r?\n/);
        this.stdoutBuffer = lines.pop() || '';

        for (const line of lines) {
          this.handleLine(line);
        }
      });

      this.process.stderr.on('data', (chunk) => {
        this.emit('debug', chunk.toString().trim());
      });

      this.process.once('spawn', () => {
        this.restartAttempts = 0;
        settled = true;
        resolve();
      });

      this.process.once('error', (error) => {
        this.emit('error', error);
        if (!settled) {
          settled = true;
          reject(error);
        }
      });

      this.process.once('close', (code, signal) => {
        this.process = null;
        this.emit('close', code, signal);
        if (!this.stopped) {
          this.scheduleRestart();
        }
      });
    });
  }

  handleLine(line) {
    if (!line.trim()) {
      return;
    }

    try {
      const parsed = JSON.parse(line);
      this.emit('message', parsed);
    } catch (_error) {
      this.emit('debug', line);
    }
  }

  scheduleRestart() {
    if (this.restartAttempts >= this.maxRestartAttempts) {
      this.emit('error', new Error(`Discrawl crashed too many times (${this.maxRestartAttempts})`));
      return;
    }

    this.restartAttempts += 1;
    setTimeout(() => {
      if (!this.stopped) {
        this.spawnProcess().catch((error) => this.emit('error', error));
      }
    }, this.restartDelayMs);
  }

  async stop() {
    this.stopped = true;

    if (!this.process) {
      return;
    }

    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      this.process.once('close', () => {
        clearTimeout(timer);
        resolve();
      });

      this.process.kill('SIGTERM');
    });
  }
}

module.exports = DiscrawlManager;
