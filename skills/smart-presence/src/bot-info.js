const fs = require('fs');
const path = require('path');
const { getDiscordBrowserPaths } = require('./utils');

async function getBotInfo(workspaceDir, config, logger) {
  const { databaseCandidates } = getDiscordBrowserPaths(workspaceDir, config);
  const databasePath = databaseCandidates.find((candidate) => fs.existsSync(candidate));

  if (!databasePath) {
    logger.warn('DiscordBrowser database not found, using fallback bot info');
    return fallbackBotInfo();
  }

  try {
    return await queryBotInfo(databasePath);
  } catch (error) {
    logger.warn(`Failed to read DiscordBrowser database at ${databasePath}: ${error.message}`);
    return fallbackBotInfo();
  }
}

function queryBotInfo(databasePath) {
  const sqlite3 = require('sqlite3');

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath, sqlite3.OPEN_READONLY, (error) => {
      if (error) {
        reject(error);
      }
    });

    const queries = [
      `SELECT user_id, username, discriminator FROM members WHERE bot = 1 ORDER BY first_seen_at DESC LIMIT 1`,
      `SELECT id AS user_id, username, discriminator FROM users WHERE bot = 1 ORDER BY id DESC LIMIT 1`
    ];

    runQuery(db, queries, 0, (error, row) => {
      db.close();
      if (error) {
        reject(error);
        return;
      }

      if (!row) {
        reject(new Error('No bot user found in DiscordBrowser database'));
        return;
      }

      resolve({
        id: row.user_id || row.id || null,
        username: row.username || 'OpenClaw',
        discriminator: row.discriminator || null,
        mention: row.user_id ? `<@${row.user_id}>` : '@OpenClaw'
      });
    });
  });
}

function runQuery(db, queries, index, callback) {
  if (index >= queries.length) {
    callback(null, null);
    return;
  }

  db.get(queries[index], (error, row) => {
    if (error) {
      runQuery(db, queries, index + 1, callback);
      return;
    }

    if (row) {
      callback(null, row);
      return;
    }

    runQuery(db, queries, index + 1, callback);
  });
}

function fallbackBotInfo() {
  return {
    id: null,
    username: 'OpenClaw',
    discriminator: null,
    mention: '@OpenClaw'
  };
}

module.exports = {
  getBotInfo
};
