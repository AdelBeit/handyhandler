#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { createDiscordGateway } = require('../src/adapters/discord-gateway');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      if (!line || line.startsWith('#')) return acc;
      const idx = line.indexOf('=');
      if (idx === -1) return acc;
      acc[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      return acc;
    }, {});
}

const repoRoot = path.resolve(__dirname, '..');
const env = loadEnv(path.join(repoRoot, '.env'));

const botToken = process.env.DISCORD_BOT_TOKEN || env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID || env.DISCORD_CHANNEL_ID;

if (!botToken || !channelId) {
  console.error('DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID are required to run the listener.');
  process.exit(1);
}

const gateway = createDiscordGateway({
  botToken,
  channelId,
  automationHandler: {
    run(data) {
      console.log('Received complete session data (stub):', data);
      return Promise.resolve({ success: true });
    },
  },
});

process.on('SIGINT', () => {
  gateway.client.destroy();
  process.exit(0);
});
