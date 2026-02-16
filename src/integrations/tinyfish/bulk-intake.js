const { createTinyFishRunner } = require('./runner');

const FALLBACK_PORTAL_URL = 'https://example.invalid';

function createTinyFishBulkIntakeRunner(options) {
  const { apiKey, baseUrl, portalUrl } = options || {};
  const runner = createTinyFishRunner({ apiKey, baseUrl });
  const intakePortalUrl = portalUrl || FALLBACK_PORTAL_URL;

  return {
    run({ prompt }) {
      if (!prompt) {
        throw new Error('bulk intake requires a prompt.');
      }
      return runner.run({
        portalUrl: intakePortalUrl,
        goal: prompt,
      });
    },
  };
}

module.exports = { createTinyFishBulkIntakeRunner };
