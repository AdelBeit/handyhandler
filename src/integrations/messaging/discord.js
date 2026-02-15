const https = require('https');

function createDiscordMessenger({ botToken }) {
  if (!botToken) {
    throw new Error('Discord bot token is required.');
  }

  const headers = {
    Authorization: `Bot ${botToken}`,
    'Content-Type': 'application/json',
  };

  function sendMessage(channelId, content) {
    if (!channelId || !content) {
      return Promise.reject(new Error('Channel ID and message content are required.'));
    }

    const body = JSON.stringify({ content });

    const options = {
      hostname: 'discord.com',
      port: 443,
      path: `/api/v10/channels/${channelId}/messages`,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body),
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
              const message = payload.message || raw;
              reject(new Error(`Discord error ${res.statusCode}: ${message}`));
            } else {
              resolve(payload);
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(body);
      req.end();
    });
  }

  return { sendMessage };
}

module.exports = { createDiscordMessenger };
