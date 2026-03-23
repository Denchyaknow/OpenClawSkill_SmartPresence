const fs = require('fs');
const path = require('path');

const INSTALL_COMMAND = 'npx clawhub install https://github.com/Denchyaknow/OpenClawSkill_DiscordBrowser';

function resolveWorkspaceDir(baseDir) {
  return path.resolve(baseDir, '..', '..', '..');
}

function resolveSkillDir(baseDir) {
  return path.resolve(baseDir, '..');
}

function getDiscordBrowserPaths(workspaceDir, config) {
  const dependencyConfig = config?.dependencies?.discordbrowser || {};
  const relativeSkillPath = dependencyConfig.path || 'skills/DiscordBrowser';
  const relativeExecutable = dependencyConfig.discrawl_executable || 'skills/DiscordBrowser/Crawlie/discrawl.exe';
  const skillPath = path.resolve(workspaceDir, relativeSkillPath);
  const executablePath = path.resolve(workspaceDir, relativeExecutable);
  const databaseCandidates = [
    path.join(skillPath, 'data', 'discord.db'),
    path.join(process.env.HOME || process.env.USERPROFILE || '', '.discrawl', 'discrawl.db')
  ].filter(Boolean);

  return {
    skillPath,
    executablePath,
    databaseCandidates,
    installCommand: dependencyConfig.install_command || INSTALL_COMMAND
  };
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(value, maxLength) {
  const stringValue = typeof value === 'string' ? value : String(value || '');
  return stringValue.length > maxLength
    ? `${stringValue.slice(0, Math.max(0, maxLength - 3))}...`
    : stringValue;
}

function coerceArray(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = {
  INSTALL_COMMAND,
  coerceArray,
  ensureDirectory,
  getDiscordBrowserPaths,
  readJson,
  resolveSkillDir,
  resolveWorkspaceDir,
  sleep,
  truncate
};
