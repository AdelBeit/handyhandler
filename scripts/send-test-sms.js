#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createTwilioMessenger } = require('../src/integrations/messaging/twilio');

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
const accountSid = process.env.TWILIO_ACCOUNT_SID || env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN || env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER || env.TWILIO_FROM_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  console.error('Missing Twilio account SID, auth token, or from number.');
  process.exit(1);
}

const toNumber = process.argv[2];
const body = process.argv[3] || 'Test SMS from Handyhandler.';
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_MESSAGING_SERVICE_SID;

if (!toNumber) {
  console.error('Usage: node scripts/send-test-sms.js <recipient> [message]');
  process.exit(1);
}

const messenger = createTwilioMessenger({
  accountSid,
  authToken,
  from: fromNumber,
  messagingServiceSid,
});

messenger
  .sendSms(toNumber, body)
  .then((result) => {
    console.log('SMS sent:', result.sid);
  })
  .catch((err) => {
    console.error('Failed to send SMS:', err.message);
    process.exit(1);
  });
