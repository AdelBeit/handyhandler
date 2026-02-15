const { env } = require('../src/config/env');
const { sendSms } = require('../src/messaging/twilio-client');

const target = process.argv[2] || env.TWILIO_TEST_RECIPIENT;
const body = process.argv[3] || 'HandyHandler Twilio smoke test';
const serviceSid = env.TWILIO_MESSAGING_SERVICE_SID;

if (!target) {
  console.error('Missing destination number. Pass it as the first argument or define TWILIO_TEST_RECIPIENT in .env.');
  process.exit(1);
}

console.log(`Sending Twilio test SMS to ${target} with body: ${body}`);

sendSms({ to: target, body, messagingServiceSid: serviceSid })
  .then(response => {
    console.log('Twilio message queued:', response.sid || 'result missing sid');
    if (response.status) {
      console.log('Status:', response.status);
    }
  })
  .catch(error => {
    console.error('Failed to send Twilio message:', error.message);
    process.exit(1);
  });
