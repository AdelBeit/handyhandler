const { getCredentialById } = require('../secrets/credentials');
const { createTinyFishRunner } = require('../integrations/tinyfish/runner');

function buildGoal(input) {
  const parts = [];
  parts.push('Submit a maintenance request.');
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
  parts.push(
    'After submitting, verify success by locating a confirmation ID or the new request in the requests list.'
  );
  parts.push('Report the confirmation ID/status or the exact list entry details as proof of submission.');
  parts.push(
    'If submission fails, respond with a structured block exactly like:\n' +
      'STATUS: FAILED\n' +
      'REASON: <short reason>\n' +
      'ACTION: <NEEDS_INFO | RETRY_LATER | BLOCKED | UNKNOWN>\n' +
      'SUGGESTED_PROMPT: <message for the user>\n' +
      'MISSING: [<optional list>]\n' +
      'If submission succeeds, respond with: STATUS: SUCCESS'
  );
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

  const goal = buildGoal(input);

  return runner.run({
    portalUrl: input.portalUrl,
    goal,
  }, input.runnerOptions);
}

module.exports = {
  submitMaintenanceRequest,
  buildGoal,
};
