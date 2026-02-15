const fs = require('fs');
const path = require('path');
const https = require('https');
const { FLOW_MESSAGES } = require('./flow-messages');

const STAGES = ['portal', 'username', 'password', 'issue', 'attachments', 'confirm', 'remediation'];

function createSessionFlow({ sessionStore, automationHandler, messenger, repoRoot }) {
  if (!sessionStore) throw new Error('sessionStore is required.');
  if (!automationHandler) throw new Error('automationHandler is required.');
  if (!messenger) throw new Error('messenger is required.');

  const root = repoRoot || path.resolve(__dirname, '..');

  function normalizeSession(session) {
    if (!STAGES.includes(session.stage)) {
      session.stage = STAGES[0];
    }
    return session;
  }

  async function handleInput(session, input) {
    normalizeSession(session);

    if (session.pendingRestart) {
      if (matches(input.text, /^(start over|yes)$/i)) {
        await cleanupSessionFiles(session);
        session.stage = 'portal';
        session.data = {};
        session.pendingRestart = false;
        return messenger.sendMessage(input.channelId, FLOW_MESSAGES.startOver);
      }
      if (matches(input.text, /^(continue|keep going|no)$/i)) {
        session.pendingRestart = false;
        return messenger.sendMessage(input.channelId, promptForStage(session));
      }
      return messenger.sendMessage(
        input.channelId,
        FLOW_MESSAGES.restartHelp
      );
    }

    if (matches(input.text, /^(cancel|abort)$/i)) {
      await cleanupSessionFiles(session);
      sessionStore.remove(session.userId);
      return messenger.sendMessage(input.channelId, FLOW_MESSAGES.cancelled);
    }

    if (matches(input.text, /^attach$/i)) {
      session.stage = 'attachments';
      return messenger.sendMessage(input.channelId, FLOW_MESSAGES.attachmentSendPrompt);
    }

    if (matches(input.text, /^more info$/i)) {
      session.stage = 'remediation';
      return messenger.sendMessage(input.channelId, FLOW_MESSAGES.remediationPrompt);
    }

    switch (session.stage) {
      case 'portal':
        session.data.portalUrl = input.text;
        session.stage = 'username';
        return messenger.sendMessage(input.channelId, FLOW_MESSAGES.usernamePrompt);
      case 'username':
        session.data.username = input.text;
        session.stage = 'password';
        return messenger.sendMessage(input.channelId, FLOW_MESSAGES.passwordPrompt);
      case 'password':
        session.data.password = input.text;
        session.stage = 'issue';
        return messenger.sendMessage(input.channelId, FLOW_MESSAGES.issuePrompt);
      case 'issue':
        session.data.issueDescription = input.text;
        session.stage = 'attachments';
        return messenger.sendMessage(input.channelId, FLOW_MESSAGES.attachmentPrompt);
      case 'attachments': {
        const attachments = extractAttachments(input.attachments);
        if (attachments.length) {
          await persistAttachments(session, attachments, root);
          const summary = attachments.map((item) => item.filename || 'attachment').join(', ');
          return messenger.sendMessage(
            input.channelId,
            FLOW_MESSAGES.attachmentSaved(attachments.length, summary)
          );
        }
        if (matches(input.text, /^(skip|done)$/i)) {
          await echoAttachments(input.channelId, session, messenger);
          const summary = formatAttachmentSummary(session);
          session.stage = 'confirm';
          return messenger.sendMessage(
            input.channelId,
            summary || FLOW_MESSAGES.attachmentNoneSaved
          );
        }
        return messenger.sendMessage(input.channelId, FLOW_MESSAGES.attachmentAwait);
      }
      case 'confirm':
        if (matches(input.text, /^yes$/i)) {
          return runAutomation(input.channelId, session, automationHandler, messenger, sessionStore);
        }
        return messenger.sendMessage(input.channelId, FLOW_MESSAGES.confirmReadyPrompt);
      case 'remediation':
        return handleRemediation(input, session, automationHandler, messenger, sessionStore, root);
      default:
        session.stage = 'portal';
        return messenger.sendMessage(input.channelId, FLOW_MESSAGES.portalPrompt);
    }
  }

  return {
    handleInput,
    normalizeSession,
  };
}

function matches(text, regex) {
  if (!text) return false;
  return regex.test(text.trim());
}

async function handleRemediation(input, session, automationHandler, messenger, sessionStore, root) {
  const attachments = extractAttachments(input.attachments);
  if (attachments.length) {
    await persistAttachments(session, attachments, root);
    return messenger.sendMessage(
      input.channelId,
      FLOW_MESSAGES.attachmentSavedRemediation(attachments.length)
    );
  }
  if (matches(input.text, /^done$/i)) {
    return runAutomation(input.channelId, session, automationHandler, messenger, sessionStore);
  }
  session.data.extras = session.data.extras || [];
  session.data.extras.push({ at: new Date().toISOString(), content: input.text });
  return messenger.sendMessage(input.channelId, FLOW_MESSAGES.remediationNoted);
}

function extractAttachments(attachments) {
  if (!attachments || attachments.length === 0) return [];
  return attachments
    .map((attachment) => ({
      url: attachment.url,
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
    }))
    .filter((attachment) => attachment.url);
}

async function persistAttachments(session, attachments, root) {
  if (!session.data.attachments) session.data.attachments = [];
  if (!session.tempDir) {
    session.tempDir = path.join(root, 'tmp', 'attachments', session.id);
    await fs.promises.mkdir(session.tempDir, { recursive: true });
  }

  const saved = await Promise.all(attachments.map((attachment) => downloadAttachment(session.tempDir, attachment)));
  for (const entry of saved) {
    if (entry) session.data.attachments.push(entry);
  }
}

function downloadAttachment(tempDir, attachment) {
  const filename = attachment.filename || `attachment-${Date.now()}`;
  const safeName = filename.replace(/[^\w.\-]+/g, '_');
  const filePath = path.join(tempDir, safeName);

  return new Promise((resolve) => {
    const file = fs.createWriteStream(filePath);
    https
      .get(attachment.url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          res.resume();
          resolve({ ...attachment, path: null, error: `HTTP ${res.statusCode}` });
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve({ ...attachment, path: filePath }));
        });
      })
      .on('error', (err) => {
        resolve({ ...attachment, path: null, error: err.message });
      });
  });
}

function formatAttachmentSummary(session) {
  if (!session.data.attachments || session.data.attachments.length === 0) return '';
  const lines = session.data.attachments.map((item) => {
    const label = item.filename || path.basename(item.path || '') || 'attachment';
    const location = item.path ? `saved at ${item.path}` : 'save failed';
    return `- ${label}: ${location}`;
  });
  return `Saved attachments:\n${lines.join('\n')}`;
}

async function echoAttachments(channelId, session, messenger) {
  if (!session.data.attachments || session.data.attachments.length === 0) return;
  const valid = session.data.attachments.filter((item) => item.path);
  if (valid.length === 0) {
    return messenger.sendMessage(channelId, FLOW_MESSAGES.attachmentEchoMissing);
  }

  const files = await Promise.all(
    valid.map(async (item) => {
      const buffer = await fs.promises.readFile(item.path);
      return {
        buffer,
        filename: item.filename || path.basename(item.path),
        contentType: item.contentType,
      };
    })
  );

  return messenger.sendFiles(channelId, files, 'Echoing saved attachments.');
}

async function cleanupSessionFiles(session) {
  if (session.tempDir) {
    try {
      await fs.promises.rm(session.tempDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`Failed to cleanup temp dir ${session.tempDir}: ${err.message}`);
    }
  }
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
  return data;
}

function outcomePrompt(outcome) {
  if (outcome.prompt) return outcome.prompt;
  if (outcome.reason) return outcome.reason;
  return FLOW_MESSAGES.automationFailed;
}

async function runAutomation(channelId, session, automationHandler, messenger, sessionStore) {
  try {
    const result = await automationHandler.run(session.data);
    if (process.env.NODE_ENV !== 'production') {
      console.log('Automation raw result:', JSON.stringify(result && result.raw, null, 2));
    }
    const outcome = parseOutcome(result);

    if (outcome.status === 'SUCCESS' || result.success) {
      messenger.sendMessage(channelId, FLOW_MESSAGES.requestSubmitted);
      if (result.confirmation) {
        messenger.sendImage(channelId, result.confirmation, FLOW_MESSAGES.confirmationImageLabel);
      }
      await cleanupSessionFiles(session);
      sessionStore.remove(session.userId);
      return;
    }

    if (outcome.action === 'USER_ACTION_REQUIRED' || outcome.action === 'NEEDS_INFO') {
      session.stage = 'remediation';
      session.data.missing = outcome.fields || outcome.reason;
      messenger.sendMessage(channelId, outcomePrompt(outcome));
      return;
    }

    messenger.sendMessage(channelId, outcomePrompt(outcome));
    await cleanupSessionFiles(session);
    sessionStore.remove(session.userId);
  } catch (err) {
    messenger.sendMessage(channelId, `Error: ${err.message}`);
    await cleanupSessionFiles(session);
    sessionStore.remove(session.userId);
  }
}

module.exports = { createSessionFlow, STAGES };
