#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { createDiscordGateway } = require('../src/adapters/discord-gateway');
const { createTinyFishRunner } = require('../src/integrations/agent-providers/tinyfish/runner');
const { buildMaintenanceGoal } = require('../src/core/maintenance-goal');
const { applyEnvDefaults, requireEnv } = require('../src/config/env');

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

applyEnvDefaults();

const botToken = process.env.DISCORD_BOT_TOKEN || env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID || env.DISCORD_CHANNEL_ID;

if (!botToken || !channelId) {
  console.error('DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID are required to run the listener.');
  process.exit(1);
}

const apiKey = requireEnv('TINYFISH_API_KEY');
const baseUrl = process.env.TINYFISH_BASE_URL || env.TINYFISH_BASE_URL;
const runner = createTinyFishRunner({ apiKey, baseUrl });

const gateway = createDiscordGateway({
  botToken,
  channelId,
  automationHandler: {
    run(data) {
      if (data && typeof data.goal === 'string' && data.portalUrl) {
        return runner.run(data);
      }

      const goal = buildMaintenanceGoal({
        issue: { description: data.issueDescription },
        credentials: {
          username: data.username,
          password: data.password,
        },
      });

      return runner.run({
        portalUrl: data.portalUrl,
        goal,
      });
    },
  },
});

process.on('SIGINT', () => {
  gateway.client.destroy();
  process.exit(0);
});
