const fs = require('fs');
const path = require('path');
const https = require('https');
const { FLOW_MESSAGES } = require('./flow-messages');
const { parseOutcome } = require('./automation-utils');
const {
  buildBulkIntakeGoal,
  normalizeExtractedFields,
  getMissingRequiredFields,
  formatV2Summary,
} = require('./v2-bulk-intake');

const STAGES = [
  'portal',
  'username',
  'password',
  'issue',
  'attachments',
  'confirm',
  'remediation',
  'v2-intake',
  'v2-confirm',
];

function getFlowVersion() {
  const raw = process.env.FLOW_VERSION || '1';
  const parsed = Number.parseInt(raw, 10);
  return parsed === 2 ? 2 : 1;
}

function createSessionFlow({ sessionStore, automationHandler, messenger, repoRoot }) {
  if (!sessionStore) throw new Error('sessionStore is required.');
  if (!automationHandler) throw new Error('automationHandler is required.');
  if (!messenger) throw new Error('messenger is required.');

  const root = repoRoot || path.resolve(__dirname, '..');

  function normalizeSession(session) {
    if (!STAGES.includes(session.stage)) {
      session.stage = getFlowVersion() === 2 ? 'v2-intake' : STAGES[0];
    }
    return session;
  }

  function startSession(session) {
    session.stage = getFlowVersion() === 2 ? 'v2-intake' : 'portal';
    session.data = session.data || {};
    return promptForStage(session);
  }

  async function handleInput(session, input) {
    normalizeSession(session);

    if (session.pendingRestart) {
      if (matches(input.text, /^(start over|yes)$/i)) {
        await cleanupSessionFiles(session);
        session.stage = getFlowVersion() === 2 ? 'v2-intake' : 'portal';
        session.data = {};
        session.pendingRestart = false;
        return messenger.sendMessage(input.channelId, promptForStage(session));
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

    if (matches(input.text, /^(cancel|abort|stop|quit|exit)$/i)) {
      await cleanupSessionFiles(session);
      sessionStore.remove(session.userId);
      return messenger.sendMessage(input.channelId, FLOW_MESSAGES.cancelled);
    }

    if (matches(input.text, /^attach$/i)) {
      if (getFlowVersion() === 2) {
        session.stage = 'v2-intake';
        return messenger.sendMessage(input.channelId, FLOW_MESSAGES.v2BulkPrompt);
      }
      session.stage = 'attachments';
      return messenger.sendMessage(input.channelId, FLOW_MESSAGES.attachmentSendPrompt);
    }

    if (matches(input.text, /^more info$/i)) {
      session.stage = 'remediation';
      return messenger.sendMessage(input.channelId, FLOW_MESSAGES.remediationPrompt);
    }

    switch (session.stage) {
      case 'v2-intake':
        return handleV2Intake(session, input, automationHandler, messenger, sessionStore, root);
      case 'v2-confirm':
        if (matches(input.text, /^(yes|submit|ok)$/i)) {
          return runAutomation(input.channelId, session, automationHandler, messenger, sessionStore);
        }
        if (matches(input.text, /^(cancel|abort|stop|quit|exit)$/i)) {
          await cleanupSessionFiles(session);
          sessionStore.remove(session.userId);
          return messenger.sendMessage(input.channelId, FLOW_MESSAGES.cancelled);
        }
        return messenger.sendMessage(input.channelId, FLOW_MESSAGES.v2ConfirmReadyPrompt);
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
    startSession,
  };
}

function matches(text, regex) {
  if (!text) return false;
  return regex.test(text.trim());
}

async function handleRemediation(input, session, automationHandler, messenger, sessionStore, root) {
  if (!session.data.remediation) {
    session.data.remediation = { state: 'collecting' };
  }
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
  if (matches(input.text, /^(options|list)$/i) && session.data.remediation.options) {
    const field = session.data.remediation.field || 'this field';
    const options = session.data.remediation.options;
    return messenger.sendMessage(input.channelId, FLOW_MESSAGES.remediationOptions(field, options));
  }
  if (session.data.remediation.state === 'awaiting_confirmation') {
    if (matches(input.text, /^yes$/i)) {
      const { field, proposal } = session.data.remediation;
      if (field && proposal) {
        session.data[field] = proposal;
      }
      session.data.remediation = null;
      return runAutomation(input.channelId, session, automationHandler, messenger, sessionStore);
    }
    if (matches(input.text, /^no$/i)) {
      const { field, options } = session.data.remediation;
      if (options && options.length) {
        session.data.remediation.state = 'awaiting_option';
        return messenger.sendMessage(input.channelId, FLOW_MESSAGES.remediationOptions(field, options));
      }
      session.data.remediation = null;
      return messenger.sendMessage(input.channelId, FLOW_MESSAGES.remediationNoted);
    }
    return messenger.sendMessage(input.channelId, FLOW_MESSAGES.remediationConfirmHint);
  }
  if (session.data.remediation.state === 'awaiting_option') {
    const selected = matchOption(input.text, session.data.remediation.options || []);
    if (selected) {
      const field = session.data.remediation.field;
      if (field) {
        session.data[field] = selected;
      }
      session.data.remediation = null;
      return runAutomation(input.channelId, session, automationHandler, messenger, sessionStore);
    }
    return messenger.sendMessage(
      input.channelId,
      `${FLOW_MESSAGES.remediationInvalidOption} ${FLOW_MESSAGES.remediationOptionsHint}`
    );
  }
  session.data.extras = session.data.extras || [];
  session.data.extras.push({ at: new Date().toISOString(), content: input.text });
  return messenger.sendMessage(input.channelId, FLOW_MESSAGES.remediationNoted);
}

async function handleV2Intake(session, input, automationHandler, messenger, sessionStore, root) {
  const attachments = extractAttachments(input.attachments);
  if (attachments.length) {
    await persistAttachments(session, attachments, root);
  }

  const message = (input.text || '').trim();
  if (!message && attachments.length) {
    return messenger.sendMessage(input.channelId, FLOW_MESSAGES.v2AttachmentOnlyPrompt);
  }
  if (!message) {
    return messenger.sendMessage(input.channelId, FLOW_MESSAGES.v2BulkPrompt);
  }

  if (!automationHandler.bulkIntake) {
    throw new Error('bulkIntake handler is required when FLOW_VERSION=2.');
  }

  const result = await automationHandler.bulkIntake({
    message,
    attachments,
    prompt: buildBulkIntakeGoal(message, attachments),
  });

  const outcome = parseOutcome(result);
  const extracted = normalizeExtractedFields(outcome.fields);
  session.data = {
    ...session.data,
    ...extracted,
  };

  const missing = getMissingRequiredFields(session.data);
  if (missing.length || outcome.action === 'USER_ACTION_REQUIRED' || outcome.action === 'NEEDS_INFO') {
    session.stage = 'remediation';
    const remediationOutcome = {
      ...outcome,
      fields: missing.length ? missing : outcome.fields,
      prompt: outcome.prompt || `Missing ${missing.join(', ')}.`,
    };
    return applyRemediationOutcome(
      input.channelId,
      session,
      remediationOutcome,
      automationHandler,
      messenger,
      sessionStore
    );
  }

  session.stage = 'v2-confirm';
  const summary = formatV2Summary(session.data);
  await messenger.sendMessage(input.channelId, summary);
  return messenger.sendMessage(input.channelId, FLOW_MESSAGES.v2ConfirmPrompt);
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

function outcomePrompt(outcome) {
  if (outcome.prompt) return outcome.prompt;
  if (outcome.reason) return outcome.reason;
  return FLOW_MESSAGES.automationFailed;
}

function normalizeOption(value) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function matchOption(input, options) {
  const normalizedInput = normalizeOption(input || '');
  if (!normalizedInput) return null;
  const normalizedMap = new Map();
  for (const option of options) {
    normalizedMap.set(normalizeOption(option), option);
  }
  return normalizedMap.get(normalizedInput) || null;
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
      await applyRemediationOutcome(channelId, session, outcome, automationHandler, messenger, sessionStore);
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

async function applyRemediationOutcome(channelId, session, outcome, automationHandler, messenger, sessionStore) {
  session.stage = 'remediation';
  session.data.missing = outcome.fields || outcome.reason;
  const field = Array.isArray(outcome.fields) ? outcome.fields[0] : outcome.fields;
  const proposal = outcome.proposal && field ? outcome.proposal[field] : null;
  const options = outcome.options && field ? outcome.options[field] : null;
  session.data.remediation = {
    state: proposal ? 'awaiting_confirmation' : options ? 'awaiting_option' : 'collecting',
    field,
    proposal,
    options: Array.isArray(options) ? options : options ? [options] : null,
  };
  if (proposal) {
    messenger.sendMessage(channelId, FLOW_MESSAGES.remediationProposal(field, proposal));
    return;
  }
  if (options && options.length) {
    messenger.sendMessage(channelId, FLOW_MESSAGES.remediationOptions(field, options));
    return;
  }
  messenger.sendMessage(channelId, outcomePrompt(outcome));
}

function promptForStage(session) {
  switch (session.stage) {
    case 'v2-intake':
      return FLOW_MESSAGES.v2BulkPrompt;
    case 'v2-confirm':
      return FLOW_MESSAGES.v2ConfirmPrompt;
    case 'portal':
      return FLOW_MESSAGES.portalPrompt;
    case 'username':
      return FLOW_MESSAGES.usernamePrompt;
    case 'password':
      return FLOW_MESSAGES.passwordPrompt;
    case 'issue':
      return FLOW_MESSAGES.issuePrompt;
    case 'attachments':
      return FLOW_MESSAGES.attachmentSendPrompt;
    case 'confirm':
      return FLOW_MESSAGES.confirmPrompt;
    case 'remediation':
      return FLOW_MESSAGES.remediationPrompt;
    default:
      return FLOW_MESSAGES.portalPrompt;
  }
}

module.exports = { createSessionFlow, STAGES };
