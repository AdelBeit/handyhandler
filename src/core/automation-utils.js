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
    }
  }

  const combined = textSources.join('\n');
  const block = parseStructuredBlock(combined);
  if (block.status) return block;

  return result.success
    ? { status: 'SUCCESS' }
    : { status: 'FAILED', action: 'UNKNOWN', reason: 'Submission failed.' };
}

module.exports = {
  parseStructuredBlock,
  parseOutcome,
};
