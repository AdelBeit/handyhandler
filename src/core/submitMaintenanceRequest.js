const { getCredentialById } = require('../secrets/credentials');
const { createTinyFishRunner } = require('../integrations/tinyfish/runner');

function buildGoal(input, credential) {
  const parts = [];
  parts.push('Submit a maintenance request.');
  if (credential && credential.username && credential.password) {
    parts.push(`Log in with username ${credential.username} and password ${credential.password}.`);
  }
  if (input.issue && input.issue.description) {
    parts.push(`Issue: ${input.issue.description}`);
  }
  if (input.issue && input.issue.location) {
    parts.push(`Location: ${input.issue.location}`);
  }
  if (input.issue && input.issue.urgency) {
    parts.push(`Urgency: ${input.issue.urgency}`);
  }
  if (input.issue && input.issue.category) {
    parts.push(`Category: ${input.issue.category}`);
  }
  parts.push('Also report how many active maintenance requests this account currently has.');
  return parts.join(' ');
}

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

  const goal = buildGoal(input, credential);

  return runner.run({
    portalUrl: input.portalUrl,
    goal,
  }, input.runnerOptions);
}

module.exports = {
  submitMaintenanceRequest,
  buildGoal,
};
