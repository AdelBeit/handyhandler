function parseStatusCommand(text) {
  if (!text) return null;
  const match = text.match(/^(?:request\s+status|status)(?:\s+(.*))?$/i);
  if (!match) return null;
  const arg = (match[1] || '').trim();
  if (!arg) return { type: 'list', filter: 'open' };
  const lower = arg.toLowerCase();
  if (['open', 'all', 'resolved', 'cancelled', 'canceled'].includes(lower)) {
    return { type: 'list', filter: lower === 'canceled' ? 'cancelled' : lower };
  }
  return { type: 'detail', query: arg };
}

function parseStatusCredentials(text) {
  if (!text) return null;
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 3) return null;
  const [portalUrl, username, password] = parts;
  if (!portalUrl || !username || !password) return null;
  return { portalUrl, username, password };
}

module.exports = { parseStatusCommand, parseStatusCredentials };
