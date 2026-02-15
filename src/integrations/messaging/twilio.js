const https = require('https');
const querystring = require('querystring');

function createTwilioMessenger({ accountSid, authToken, from, messagingServiceSid }) {
  if (!accountSid || !authToken) {
    throw new Error('Twilio accountSid and authToken are required.');
  }
  if (!from && !messagingServiceSid) {
    throw new Error('Either Twilio from number or messagingServiceSid is required.');
  }

  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
  const path = `/2010-04-01/Accounts/${accountSid}/Messages.json`;

  function sendSms(to, body) {
    if (!to || !body) {
      return Promise.reject(new Error('Recipient number and message body are required.'));
    }

    const params = {
      To: to,
      Body: body,
    };
    if (from) params.From = from;
    if (messagingServiceSid) params.MessagingServiceSid = messagingServiceSid;
    const payload = querystring.stringify(params);

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path,
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const payload = JSON.parse(raw);
            if (res.statusCode >= 400) {
              reject(new Error(`Twilio error ${res.statusCode}: ${payload.message || raw}`));
            } else {
              resolve(payload);
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(payload);
      req.end();
    });
  }

  return { sendSms };
}

module.exports = { createTwilioMessenger };
