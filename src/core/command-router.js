function createCommandRouter({ requestStore, messenger }) {
  if (!requestStore) throw new Error('requestStore is required.');
  if (!messenger) throw new Error('messenger is required.');

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

  function handleStatusCommand({ command, userId, channelId }) {
    if (!command) return false;
    if (command.type === 'list') {
      const filter = command.filter || 'open';
      const requests = requestStore.list(userId, filter);
      const response = formatStatusList(filter, requests);
      messenger.sendMessage(channelId, response);
      return true;
    }

    const request = requestStore.findById(userId, command.query);
    if (!request) {
      messenger.sendMessage(
        channelId,
        'I could not find that request. Reply `status` to see open requests or `status all` to list everything.'
      );
      return true;
    }
    messenger.sendMessage(channelId, formatStatusDetail(request));
    return true;
  }

  function maybeHandle(input) {
    const command = parseStatusCommand(input.text);
    if (!command) return false;
    return handleStatusCommand({
      command,
      userId: input.userId,
      channelId: input.channelId,
    });
  }

  return {
    parseStatusCommand,
    handleStatusCommand,
    maybeHandle,
  };
}

function formatStatusList(filter, requests) {
  const normalized = (filter || 'open').toLowerCase();
  const isOpen = normalized === 'open';
  const limit = isOpen ? 5 : 10;
  if (!requests.length) {
    return `No ${normalized} requests on record. Reply \`status all\` to view everything or \`status resolved\` / \`status cancelled\` to filter.`;
  }
  const visible = requests.slice(0, limit);
  const lines = visible.map((item) => formatStatusLine(item)).join('\n');
  const total = requests.length;
  const header = isOpen
    ? `Open requests (showing ${visible.length} of ${total}):`
    : `${normalized.charAt(0).toUpperCase() + normalized.slice(1)} requests (showing ${visible.length} of ${total}):`;
  const hint =
    'Reply `status <request-id>` for details, or use `status all`, `status resolved`, or `status cancelled`.';
  return `${header}\n${lines}\n${hint}`;
}

function formatStatusLine(request) {
  const issue = request.issueDescription ? truncateText(request.issueDescription, 48) : 'No issue description';
  const submitted = request.createdAt ? request.createdAt.slice(0, 10) : 'unknown date';
  return `- ${request.id} — ${issue} (submitted ${submitted})`;
}

function formatStatusDetail(request) {
  const submitted = request.createdAt ? request.createdAt.slice(0, 10) : 'unknown';
  const updated = request.updatedAt ? request.updatedAt.slice(0, 10) : submitted;
  const issue = request.issueDescription || 'No issue description provided.';
  const portal = request.portalUrl || 'No portal URL recorded.';
  return [
    `Request ${request.id}`,
    `Status: ${request.status}`,
    `Submitted: ${submitted}`,
    `Last updated: ${updated}`,
    `Portal: ${portal}`,
    `Issue: ${issue}`,
  ].join('\n');
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

module.exports = { createCommandRouter };
