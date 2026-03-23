const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const MessageBuffer = require('../src/buffer');
const FilterEngine = require('../src/filter');
const WebhookClient = require('../src/webhook');
const { validateConfig } = require('../src/config');
const { getDiscordBrowserPaths } = require('../src/utils');

const sampleConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'config', 'smart-presence.json'), 'utf8')
);

test('config validates successfully', () => {
  assert.doesNotThrow(() => validateConfig(sampleConfig));
});

test('buffer deduplicates and limits context', () => {
  const buffer = new MessageBuffer(2, 5, 1000);
  assert.equal(buffer.add({ id: '1', channel_id: 'c', content: 'one' }), true);
  assert.equal(buffer.add({ id: '1', channel_id: 'c', content: 'one' }), false);
  assert.equal(buffer.add({ id: '2', channel_id: 'c', content: 'two' }), true);
  assert.equal(buffer.add({ id: '3', channel_id: 'c', content: 'three' }), true);
  assert.deepEqual(buffer.getContext('c', 5).map((entry) => entry.id), ['3', '2']);
});

test('filter engine enforces whitelist and rate limits', () => {
  const filter = new FilterEngine(sampleConfig);
  const baseMessage = {
    id: '1',
    guild_id: '794700691490078740',
    channel_id: '818828164251516958',
    author_id: 'u1',
    author_name: 'Tester',
    content: 'hello there'
  };

  assert.equal(filter.shouldProcess(baseMessage).pass, true);
  assert.equal(filter.shouldProcess({ ...baseMessage, id: '2' }).pass, false);
  assert.match(filter.shouldProcess({ ...baseMessage, id: '3', channel_id: 'other' }).reason, /whitelist|Global rate limit/);
});

test('webhook client formats context text', () => {
  const client = new WebhookClient(sampleConfig.webhook);
  const text = client.formatContext({
    channel_id: 'chan',
    channel_name: 'general',
    guild_id: 'guild',
    bot_username: 'OpenClaw',
    messages: [
      { created_at: '2026-03-23T08:30:00Z', author_name: 'Dencho', content: 'Hello world' }
    ]
  });

  assert.match(text, /Smart Presence/);
  assert.match(text, /general/);
  assert.match(text, /Dencho/);
});

test('discord browser paths resolve relative to workspace', () => {
  const paths = getDiscordBrowserPaths('/tmp/workspace', sampleConfig);
  assert.equal(paths.executablePath, path.join('/tmp/workspace', 'skills', 'DiscordBrowser', 'Crawlie', 'discrawl.exe'));
});
