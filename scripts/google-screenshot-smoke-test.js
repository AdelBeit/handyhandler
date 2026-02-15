#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createTinyFishRunner } = require('../src/integrations/tinyfish/runner');

const repoRoot = path.resolve(__dirname, '..');
const envFile = path.join(repoRoot, '.env');
const env = fs.existsSync(envFile)
  ? fs
      .readFileSync(envFile, 'utf8')
      .split(/\r?\n/)
      .reduce((acc, line) => {
        if (!line || line.trim().startsWith('#')) return acc;
        const idx = line.indexOf('=');
        if (idx === -1) return acc;
        acc[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        return acc;
      }, {})
  : {};

const apiKey = process.env.TINYFISH_API_KEY || env.TINYFISH_API_KEY;
if (!apiKey) {
  console.error('Missing TINYFISH_API_KEY (set in .env or env var).');
  process.exit(1);
}

const portalUrl = process.argv[2] || 'https://www.google.com';
const query = process.argv[3] || 'TinyFish automation';
const baseUrlOverride = process.argv[4];

const goal = [
  'Open the page.',
  `Search Google for "${query}".`,
  'Open the first non-ad result.',
  'Take a screenshot of the result page and return a confirmation image.'
].join(' ');

const runner = createTinyFishRunner({
  apiKey,
  baseUrl: baseUrlOverride,
});

runner
  .run(
    {
      portalUrl,
      goal,
    },
    {
      onEvent(event) {
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
            console.log('RESULT:', JSON.stringify(event.resultJson, null, 2));
          }
        }
      },
    }
  )
  .then((result) => {
    if (!result.success) {
      console.error('Run failed:', result.raw);
      process.exit(1);
    }
    if (result.confirmation) {
      console.log('CONFIRMATION_IMAGE:', result.confirmation);
    }
    console.log('DONE');
  })
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
