function buildMaintenanceGoal(input) {
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
  if (input.credentials && input.credentials.username) {
    parts.push(`Portal username: ${input.credentials.username}`);
  }
  if (input.credentials && input.credentials.password) {
    parts.push(`Portal password: ${input.credentials.password}`);
  }
  parts.push(
    'After submitting, verify success by locating a confirmation ID or the new request in the requests list.'
  );
  parts.push('Report the confirmation ID/status or the exact list entry details as proof of submission.');
  parts.push(
    'If submission fails, respond with a structured block exactly like:\n' +
      'STATUS: FAILED\n' +
      'REASON: <short reason>\n' +
      'ACTION: <USER_ACTION_REQUIRED | RETRY_LATER | BLOCKED | UNKNOWN>\n' +
      'SUGGESTED_PROMPT: <message for the user>\n' +
      'FIELDS: [<optional list of fields or corrections>]\n' +
      'PROPOSAL: {<field>: <proposed value>}\n' +
      'OPTIONS: {<field>: [<allowed option 1>, <allowed option 2>]}\n' +
      'If submission succeeds, respond with: STATUS: SUCCESS'
  );
  return parts.join(' ');
}

module.exports = { buildMaintenanceGoal };
