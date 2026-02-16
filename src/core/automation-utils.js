function parseStructuredBlock(text) {
  if (!text) return {};
  const lines = text.split(/\r?\n/);
  const data = {};
  for (const line of lines) {
    const match = line.match(/^([A-Z_]+):\s*(.+)$/);
    if (!match) continue;
    data[match[1]] = match[2].trim();
  }
  if (data.STATUS) data.status = data.STATUS;
  if (data.ACTION) data.action = data.ACTION;
  if (data.REASON) data.reason = data.REASON;
  if (data.SUGGESTED_PROMPT) data.prompt = data.SUGGESTED_PROMPT;
  if (data.FIELDS) {
    try {
      data.fields = JSON.parse(data.FIELDS);
    } catch {
      data.fields = data.FIELDS;
    }
  }
  if (data.PROPOSAL) {
    try {
      data.proposal = JSON.parse(data.PROPOSAL);
    } catch {
      data.proposal = data.PROPOSAL;
    }
  }
  if (data.OPTIONS) {
    try {
      data.options = JSON.parse(data.OPTIONS);
    } catch {
      data.options = data.OPTIONS;
    }
  }
  return data;
}

function parseOutcome(result) {
  if (!result) return { status: 'FAILED', action: 'UNKNOWN', reason: 'Unknown failure.' };

  const textSources = [];
  if (result.raw) {
    if (typeof result.raw.message === 'string') textSources.push(result.raw.message);
    if (typeof result.raw.resultJson === 'string') textSources.push(result.raw.resultJson);
    if (result.raw.resultJson && typeof result.raw.resultJson === 'object') {
      if (typeof result.raw.resultJson.message === 'string') textSources.push(result.raw.resultJson.message);
      if (typeof result.raw.resultJson.status === 'string') textSources.push(result.raw.resultJson.status);
      if (typeof result.raw.resultJson.result === 'string') textSources.push(result.raw.resultJson.result);
    }
  }

  const combined = textSources.join('\n');
  const block = parseStructuredBlock(combined);
  if (block.status) return block;

  return result.success
    ? { status: 'SUCCESS' }
    : { status: 'FAILED', action: 'UNKNOWN', reason: 'Submission failed.' };
}

function extractConfirmationDetails(result) {
  const raw = result && result.raw;
  if (!raw || typeof raw !== 'object') return null;
  const resultJson = raw.resultJson;
  if (!resultJson || typeof resultJson !== 'object') return null;

  const textSources = [];
  if (typeof raw.message === 'string') textSources.push(raw.message);
  if (typeof resultJson.message === 'string') textSources.push(resultJson.message);
  if (typeof resultJson.result === 'string') textSources.push(resultJson.result);

  const block = parseStructuredBlock(textSources.join('\n'));
  const fromBlock =
    block.CONFIRMATION_ID ||
    block.CASE_ID ||
    block.REQUEST_ID ||
    block.confirmationId ||
    block.caseId ||
    block.requestId ||
    block.confirmation_id ||
    block.case_id ||
    block.request_id;

  if (fromBlock) {
    return { confirmationId: fromBlock, details: resultJson.request_details || null };
  }

  const confirmationId =
    resultJson.confirmation_id ||
    resultJson.confirmationId ||
    (resultJson.request_details && (resultJson.request_details.case_id || resultJson.request_details.caseId));

  const details = resultJson.request_details || null;
  if (!confirmationId) {
    const fallback = findIdInObject(resultJson);
    if (fallback) {
      return { confirmationId: fallback, details };
    }
  }
  if (!confirmationId && !details) return null;
  return { confirmationId, details };
}

function findIdInObject(obj, seen = new Set()) {
  if (!obj || typeof obj !== 'object') return null;
  if (seen.has(obj)) return null;
  seen.add(obj);
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const lower = key.toLowerCase();
      if (lower.includes('confirmation') || lower.includes('case') || lower.includes('request')) {
        return value;
      }
    } else if (value && typeof value === 'object') {
      const nested = findIdInObject(value, seen);
      if (nested) return nested;
    }
  }
  return null;
}

module.exports = {
  parseStructuredBlock,
  parseOutcome,
  extractConfirmationDetails,
};
