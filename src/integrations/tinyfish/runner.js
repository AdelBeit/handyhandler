const https = require('https');
const { validateAutomationRequest } = require('../automation');

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

                  if (event.type === 'COMPLETE' && !resolved) {
                    resolved = true;
                    resolve({
                      success: event.status === 'COMPLETED',
                      raw: event,
                      events,
                    });
                  }
                }
              }
            });

            res.on('end', () => {
              if (!resolved) {
                resolved = true;
                resolve({
                  success: false,
                  raw: { type: 'END_OF_STREAM' },
                  events,
                });
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

module.exports = {
  createTinyFishRunner,
};
