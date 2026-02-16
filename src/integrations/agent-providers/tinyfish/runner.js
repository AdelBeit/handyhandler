const https = require('https');
const { validateAutomationRequest } = require('../../automation');

function createTinyFishRunner(options) {
  const apiKey = options && options.apiKey;
  const baseUrl = (options && options.baseUrl) || 'https://agent.tinyfish.ai';

  if (!apiKey) {
    throw new Error('TinyFish apiKey is required.');
  }

  return {
    /**
     * @param {import('../automation').AutomationRequest} req
     * @param {{ onEvent?: (event: Object) => void }} [opts]
     * @returns {Promise<import('../automation').AutomationResult>}
     */
    run(req, opts) {
      validateAutomationRequest(req);

      const url = new URL(baseUrl);
      const body = JSON.stringify({
        url: req.portalUrl,
        goal: req.goal,
      });

      return new Promise((resolve, reject) => {
        const events = [];
        let resolved = false;
        let buffer = '';
        let confirmation = null;

        const request = https.request(
          {
            hostname: url.hostname,
            path: '/v1/automation/run-sse',
            method: 'POST',
            headers: {
              'X-API-Key': apiKey,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            },
          },
          (res) => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`TinyFish HTTP ${res.statusCode}`));
              return;
            }

            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              buffer += chunk;
              let idx;
              while ((idx = buffer.indexOf('\n\n')) !== -1) {
                const block = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 2);

                const lines = block.split('\n');
                for (const line of lines) {
                  if (!line.startsWith('data: ')) continue;
                  const payload = line.slice(6).trim();
                  if (!payload) continue;

                  let event;
                  try {
                    event = JSON.parse(payload);
                  } catch (err) {
                    events.push({ type: 'PARSE_ERROR', raw: payload });
                    if (opts && opts.onEvent) opts.onEvent({ type: 'PARSE_ERROR', raw: payload });
                    continue;
                  }

                  events.push(event);
                  if (opts && opts.onEvent) opts.onEvent(event);

                  const candidate = extractConfirmation(event);
                  if (candidate) confirmation = candidate;

                  if (event.type === 'COMPLETE' && !resolved) {
                    resolved = true;
                    const result = {
                      success: event.status === 'COMPLETED',
                      confirmation,
                      raw: event,
                      events,
                    };
                    if (process.env.NODE_ENV !== 'production') {
                      console.log('TinyFish complete event:', JSON.stringify(event, null, 2));
                    }
                    resolve(result);
                  }
                }
              }
            });

            res.on('end', () => {
              if (!resolved) {
                resolved = true;
                const result = {
                  success: false,
                  confirmation,
                  raw: { type: 'END_OF_STREAM' },
                  events,
                };
                if (process.env.NODE_ENV !== 'production') {
                  console.log('TinyFish end of stream:', JSON.stringify(result.raw, null, 2));
                }
                resolve(result);
              }
            });
          }
        );

        request.on('error', (err) => {
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        });

        request.write(body);
        request.end();
      });
    },
  };
}

function extractConfirmation(event) {
  if (!event || typeof event !== 'object') return null;

  const direct = pickImageCandidate(event);
  if (direct) return direct;

  if (event.data && typeof event.data === 'object') {
    const fromData = pickImageCandidate(event.data);
    if (fromData) return fromData;
  }

  if (event.payload && typeof event.payload === 'object') {
    const fromPayload = pickImageCandidate(event.payload);
    if (fromPayload) return fromPayload;
  }

  return null;
}

function pickImageCandidate(obj) {
  const keys = [
    'confirmation',
    'confirmationImage',
    'confirmation_image',
    'screenshot',
    'screenshotUrl',
    'screenshot_url',
    'imageUrl',
    'image_url',
    'artifactUrl',
    'artifact_url',
    'url',
  ];

  for (const key of keys) {
    const value = obj[key];
    if (typeof value !== 'string') continue;
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image/')) {
      if (obj.type && typeof obj.type === 'string') {
        const upper = obj.type.toUpperCase();
        if (!upper.includes('SCREENSHOT') && !upper.includes('CONFIRM') && !upper.includes('ARTIFACT')) {
          continue;
        }
      }
      return value;
    }
  }

  return null;
}

module.exports = {
  createTinyFishRunner,
};
