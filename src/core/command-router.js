const { parseStatusCommand, parseStatusCredentials } = require('./utils/status-command');
const { FLOW_MESSAGES } = require('./flow-messages');

function createCommandRouter({ automationHandler, messenger }) {
  if (!automationHandler) throw new Error('automationHandler is required.');
  if (!messenger) throw new Error('messenger is required.');

  async function maybeHandle(session, input) {
    if (session.data && session.data.statusLookupPending) {
      const creds = parseStatusCredentials(input.text);
      if (!creds) {
        messenger.sendMessage(input.channelId, FLOW_MESSAGES.statusCredentialsPrompt);
        return true;
      }
      session.data.portalUrl = creds.portalUrl;
      session.data.username = creds.username;
      session.data.password = creds.password;
      session.data.statusLookupPending = false;
      await runStatusLookup(session, input.channelId);
      return true;
    }

    const statusCommand = parseStatusCommand(input.text);
    if (!statusCommand) return false;
    session.data.statusCommand = statusCommand;
    if (!session.data.portalUrl || !session.data.username || !session.data.password) {
      session.data.statusLookupPending = true;
      messenger.sendMessage(input.channelId, FLOW_MESSAGES.statusCredentialsPrompt);
      return true;
    }
    await runStatusLookup(session, input.channelId);
    return true;
  }

  async function runStatusLookup(session, channelId) {
    try {
      const command = session.data.statusCommand || { type: 'list', filter: 'open' };
      const goal = buildStatusGoal(session, command);
      const result = await automationHandler.run({
        portalUrl: session.data.portalUrl,
        goal,
      });
      const message = extractStatusMessage(result);
      messenger.sendMessage(channelId, message || FLOW_MESSAGES.statusLookupFailed);
    } catch (err) {
      messenger.sendMessage(channelId, FLOW_MESSAGES.statusLookupFailed);
    } finally {
      session.data.statusCommand = null;
    }
  }

  return { maybeHandle };
}

function buildStatusGoal(session, command) {
  const parts = [];
  parts.push('Log in to the portal and retrieve maintenance request statuses.');
  parts.push(`Portal URL: ${session.data.portalUrl}`);
  parts.push(`Username: ${session.data.username}`);
  parts.push(`Password: ${session.data.password}`);
  if (command.type === 'detail') {
    parts.push(`Search for the request matching: ${command.query}.`);
    parts.push('Match by case/request number, description, title, or other identifying details.');
    parts.push(
      'If you cannot find an exact match, respond with a clear not-found message and include the top 5 most recent requests.'
    );
  } else {
    const filter = command.filter || 'open';
    parts.push(`List the ${filter} requests (top 5 most recent if not specified).`);
  }
  parts.push('Reply with a clear, user-facing summary.');
  return parts.join(' ');
}

function extractStatusMessage(result) {
  if (!result || !result.raw) return null;
  const raw = result.raw;
  const resultJson = raw.resultJson;
  if (resultJson && typeof resultJson === 'object') {
    if (typeof resultJson.message === 'string') return resultJson.message;
    if (typeof resultJson.result === 'string') return resultJson.result;
  }
  if (typeof raw.message === 'string') return raw.message;
  return null;
}

module.exports = { createCommandRouter };
