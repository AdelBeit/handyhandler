const { REQUIRED_FIELDS, REQUIRED_FIELD_KEYS, REQUIRED_FIELD_LABEL_BY_KEY } = require('./v2-constants');

const BULK_INTAKE_FIELD_KEYS = REQUIRED_FIELDS.map((field) => field.key).join(', ');
const FALLBACK_PORTAL_URL = 'https://example.invalid';
const BULK_INTAKE_FIELD_LABELS = REQUIRED_FIELDS.map((field) => field.label).join(', ');

function buildBulkIntakeSystemPrompt() {
  return [
    'You are extracting required fields from a user message for a maintenance request.',
    `Required fields: ${BULK_INTAKE_FIELD_LABELS}.`,
    'You will also receive INTAKE_SO_FAR (previously captured values as plain text).',
    'Only ask for fields that are missing or empty in the combined result.',
    'Return a structured block with:',
    'STATUS: SUCCESS or FAILED',
    'ACTION: NEEDS_INFO or USER_ACTION_REQUIRED when required fields are missing',
    'FIELDS: portalUrl=<value>; username=<value>; password=<value>; issueDescription=<value> (include any confident values; leave missing fields empty)',
    'REASON: short reason if fields are missing',
    'SUGGESTED_PROMPT: a concise question that asks only for the missing fields (do not ask for fields already present)',
    'Do not return JSON. Return the structured block as plain text.',
  ].join('\n');
}

function buildBulkIntakeGoal({ message, attachments, intakeSoFar }) {
  const attachmentLines = (attachments || []).map((item) => {
    const label = item.filename || item.url || 'attachment';
    return `- ${label}`;
  });
  const attachmentBlock = attachmentLines.length
    ? `ATTACHMENTS:\n${attachmentLines.join('\n')}`
    : 'ATTACHMENTS: none';

  return [
    buildBulkIntakeSystemPrompt(),
    `INTAKE_SO_FAR:\n${intakeSoFar || ''}`,
    'USER_MESSAGE:',
    message || '',
    attachmentBlock,
  ].join('\n');
}

function buildBulkIntakeRequest({ message, attachments, intakeSoFar }) {
  return {
    portalUrl: FALLBACK_PORTAL_URL,
    goal: buildBulkIntakeGoal({ message, attachments, intakeSoFar }),
  };
}

function normalizeExtractedFields(fields) {
  if (!fields || typeof fields !== 'object') return {};
  const normalized = {};
  for (const key of REQUIRED_FIELD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
    const value = fields[key];
    if (typeof value === 'string' && value.trim()) {
      normalized[key] = value.trim();
      continue;
    }
    if (value) {
      normalized[key] = value;
    }
  }
  return normalized;
}

function getMissingRequiredFields(fields) {
  const missing = [];
  for (const key of REQUIRED_FIELD_KEYS) {
    if (!fields || fields[key] == null || fields[key] === '') {
      missing.push(REQUIRED_FIELD_LABEL_BY_KEY[key] || key);
    }
  }
  return missing;
}

function formatV2Summary(data) {
  const lines = [];
  if (data.portalUrl) lines.push(`Portal URL: ${data.portalUrl}`);
  if (data.username) lines.push(`Username: ${data.username}`);
  if (data.password) lines.push('Password: (captured)');
  if (data.issueDescription) lines.push(`Issue: ${data.issueDescription}`);
  return lines.length ? lines.join('\n') : 'No details were captured yet.';
}

module.exports = {
  buildBulkIntakeGoal,
  buildBulkIntakeRequest,
  normalizeExtractedFields,
  getMissingRequiredFields,
  formatV2Summary,
};
