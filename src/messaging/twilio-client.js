const https = require('https');
const { URLSearchParams } = require('url');
const { requireEnv } = require('../config/env');

function buildPostData({ body, to, messagingServiceSid }) {
  const params = new URLSearchParams();
  if (messagingServiceSid) {
    params.append('MessagingServiceSid', messagingServiceSid);
  } else {
    params.append('From', requireEnv('TWILIO_FROM_NUMBER'));
  }
  params.append('To', to);
  params.append('Body', body);
  return params.toString();
}

function sendSms({ to, body = 'HandyHandler maintenance update', messagingServiceSid }) {
  if (!to) {
    return Promise.reject(new Error('Destination phone number is required to send SMS'));
  }
  const accountSid = requireEnv('TWILIO_ACCOUNT_SID');
  const authToken = requireEnv('TWILIO_AUTH_TOKEN');
  const postData = buildPostData({ body, to, messagingServiceSid });
  const options = {
    hostname: 'api.twilio.com',
    path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let buffers = '';
      res.on('data', chunk => {
        buffers += chunk;
      });
      res.on('end', () => {
        const result = buffers.trim();
        if (res.statusCode >= 400) {
          return reject(new Error(`Twilio error (${res.statusCode}): ${result}`));
        }
        try {
          resolve(JSON.parse(result));
        } catch (error) {
          resolve({ raw: result });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = {
  sendSms,
};
