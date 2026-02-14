#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { submitMaintenanceRequest } = require('../src/core/submitMaintenanceRequest');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    out[key] = val;
  }
  return out;
}

const repoRoot = path.resolve(__dirname, '..');
const env = loadEnv(path.join(repoRoot, '.env'));
const apiKey = process.env.TINYFISH_API_KEY || env.TINYFISH_API_KEY;

if (!apiKey) {
  console.error('Missing TINYFISH_API_KEY (set in .env or env var).');
  process.exit(1);
}

const portalUrl = process.argv[2] || 'https://www.google.com/finance/quote/GOOGL:NASDAQ';
const credentialId = process.argv[3] || 'demo-tenant-001';
const description = process.argv[4] || 'Test request: smoke test.';

submitMaintenanceRequest({
  apiKey,
  portalUrl,
  credentialId,
  issue: {
    description,
  },
  runnerOptions: {
    onEvent: (event) => {
      if (event.type === 'STREAMING_URL') {
        console.log(`STREAMING_URL: ${event.streamingUrl}`);
        return;
      }
      if (event.type === 'PROGRESS') {
        console.log(`PROGRESS: ${event.purpose || ''}`);
        return;
      }
      if (event.type === 'COMPLETE') {
        console.log(`COMPLETE: ${event.status}`);
        if (event.resultJson) {
          console.log('RESULT:', JSON.stringify(event.resultJson));
        }
      }
    },
  },
})
  .then((result) => {
    if (!result.success) {
      console.error('Run did not complete successfully.');
      process.exit(1);
    }
    console.log('DONE');
  })
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
