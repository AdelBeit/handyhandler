#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createDiscordMessenger } = require('../src/integrations/messaging/discord');

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
const defaultChannel = process.env.DISCORD_CHANNEL_ID || env.DISCORD_CHANNEL_ID;

if (!botToken || !defaultChannel) {
  console.error('DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID are required.');
  process.exit(1);
}

const channelId = process.argv[2] || defaultChannel;
const message = process.argv[3] || 'Test message from Handyhandler Discord bot.';

if (!channelId) {
  console.error('Usage: node scripts/send-test-discord.js <channelId> [message]');
  process.exit(1);
}

const messenger = createDiscordMessenger({ botToken });

messenger
  .sendMessage(channelId, message)
  .then((result) => {
    console.log('Sent Discord message:', result.id);
  })
  .catch((err) => {
    console.error('Failed to send Discord message:', err.message);
    process.exit(1);
  });
