const https = require('https');

function createDiscordMessenger({ botToken }) {
  if (!botToken) {
    throw new Error('Discord bot token is required.');
  }

  const headers = {
    Authorization: `Bot ${botToken}`,
    'Content-Type': 'application/json',
  };

  function sendEmbed(channelId, embed, content) {
    if (!channelId) {
      return Promise.reject(new Error('Channel ID is required.'));
    }
    const body = JSON.stringify({
      content,
      embeds: [embed],
    });

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

  function sendImage(channelId, image, content) {
    if (!channelId) {
      return Promise.reject(new Error('Channel ID is required.'));
    }
    if (!image) {
      return Promise.reject(new Error('Image is required.'));
    }

    if (typeof image === 'string' && image.startsWith('http')) {
      return sendEmbed(channelId, { image: { url: image } }, content);
    }

    const dataMatch =
      typeof image === 'string' ? image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/) : null;
    if (!dataMatch) {
      return sendMessage(channelId, content || 'Confirmation image is available but could not be attached.');
    }

    const mimeType = dataMatch[1];
    const buffer = Buffer.from(dataMatch[2], 'base64');
    const ext = mimeType.split('/')[1] || 'png';
    const filename = `confirmation.${ext}`;
    const boundary = `----discordform${Date.now()}`;
    const payload = JSON.stringify({ content });

    const headerPart =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="payload_json"\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${payload}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="files[0]"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`;
    const footerPart = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([Buffer.from(headerPart, 'utf8'), buffer, Buffer.from(footerPart, 'utf8')]);

    const options = {
      hostname: 'discord.com',
      port: 443,
      path: `/api/v10/channels/${channelId}/messages`,
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const payloadResponse = JSON.parse(raw);
            if (res.statusCode >= 400) {
              const message = payloadResponse.message || raw;
              reject(new Error(`Discord error ${res.statusCode}: ${message}`));
            } else {
              resolve(payloadResponse);
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

  function sendFiles(channelId, files, content) {
    if (!channelId) {
      return Promise.reject(new Error('Channel ID is required.'));
    }
    if (!Array.isArray(files) || files.length === 0) {
      return Promise.reject(new Error('Files are required.'));
    }

    const boundary = `----discordform${Date.now()}`;
    const payload = JSON.stringify({ content });

    let body = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="payload_json"\r\n` +
        `Content-Type: application/json\r\n\r\n` +
        `${payload}\r\n`,
      'utf8'
    );

    files.forEach((file, idx) => {
      const filename = file.filename || `attachment-${idx + 1}`;
      const mimeType = file.contentType || 'application/octet-stream';
      const header =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="files[${idx}]"; filename="${filename}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`;
      body = Buffer.concat([body, Buffer.from(header, 'utf8'), file.buffer, Buffer.from('\r\n', 'utf8')]);
    });

    body = Buffer.concat([body, Buffer.from(`--${boundary}--\r\n`, 'utf8')]);

    const options = {
      hostname: 'discord.com',
      port: 443,
      path: `/api/v10/channels/${channelId}/messages`,
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const payloadResponse = JSON.parse(raw);
            if (res.statusCode >= 400) {
              const message = payloadResponse.message || raw;
              reject(new Error(`Discord error ${res.statusCode}: ${message}`));
            } else {
              resolve(payloadResponse);
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

  return { sendMessage, sendImage, sendFiles };
}

module.exports = { createDiscordMessenger };
