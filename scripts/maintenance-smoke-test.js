#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { getCredentialById } = require('../src/secrets/credentials');
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

const credentialId = process.argv[3] || 'demo-tenant-001';
const portalOverride = process.argv[2];
const summary = process.argv[4] || 'Smoke-test maintenance request';
const details = process.argv[5] || 'Automation-generated request for validation.';
const urgency = process.argv[6] || 'Normal';
const category = process.argv[7] || 'General';
const baseUrlOverride = process.argv[8];

const credentialsPath = (() => {
  const primary = path.join(repoRoot, 'data', 'credentials.json');
  const fallback = path.join(repoRoot, 'data', 'credentials.sample.json');
  if (fs.existsSync(primary)) return primary;
  if (fs.existsSync(fallback)) return fallback;
  return primary;
})();

let credential;
try {
  credential = getCredentialById(credentialId, credentialsPath);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

if (!credential) {
  console.error(`Credential not found: ${credentialId}`);
  process.exit(1);
}

const portalUrl = portalOverride || credential.portalUrl;
if (!portalUrl) {
  console.error('No portal URL provided and credential lacks one.');
  process.exit(1);
}

const goal = [
  `Log in with username ${credential.username} and password ${credential.password}.`,
  'Navigate to the maintenance request form, fill in the fields below, and submit the request.',
  `Summary: ${summary}.`,
  `Category: ${category}.`,
  `Urgency: ${urgency}.`,
  `Details: ${details}.`,
  'After submission, return to the landing page and report how many active maintenance requests are displayed.',
].join('\n');

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
    console.log('DONE');
  })
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
