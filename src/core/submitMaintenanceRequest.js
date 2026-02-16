const { getCredentialById } = require('../secrets/credentials');
const { createTinyFishRunner } = require('../integrations/agent-providers/tinyfish/runner');
const { buildMaintenanceGoal } = require('./maintenance-goal');

function submitMaintenanceRequest(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('submitMaintenanceRequest requires input.');
  }
  if (!input.portalUrl) {
    throw new Error('submitMaintenanceRequest requires portalUrl.');
  }
  if (!input.credentialId) {
    throw new Error('submitMaintenanceRequest requires credentialId.');
  }
  if (!input.apiKey) {
    throw new Error('submitMaintenanceRequest requires apiKey.');
  }

  const credential = getCredentialById(input.credentialId, input.credentialsPath);
  if (!credential) {
    throw new Error(`Credential not found: ${input.credentialId}`);
  }

  const runner = createTinyFishRunner({
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
  });

  const goal = buildMaintenanceGoal({
    issue: input.issue,
    credentials: {
      username: credential.username,
      password: credential.password,
    },
  });

  return runner.run({
    portalUrl: input.portalUrl,
    goal,
  }, input.runnerOptions);
}

module.exports = {
  submitMaintenanceRequest,
};
