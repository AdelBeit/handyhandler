const fs = require('fs');
const path = require('path');
const https = require('https');
const { Client, GatewayIntentBits, ChannelType, Partials } = require('discord.js');
const { createDiscordMessenger } = require('../integrations/messaging/discord');
const { createSessionStore } = require('./session-store');

const STAGES = ['portal', 'username', 'password', 'issue', 'attachments', 'confirm', 'remediation'];

function loadCommandDefinitions(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Unable to load Discord command definitions from ${filePath}: ${error.message}`);
    return [];
  }
}

function buildCommandRegex(phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

function loadCommands() {
  const commandsPath = path.resolve(__dirname, '../../data/commands.json');
  const commandDefinitions = loadCommandDefinitions(commandsPath);
  if (!commandDefinitions.length) {
    return [/^make (a )?maintenance request$/i, /^new maintenance request$/i];
  }
  return commandDefinitions.map((def) => buildCommandRegex(def.phrase));
}

function stripBotMention(content, clientUser) {
  if (!clientUser) return content;
  const mentionPattern = new RegExp(`<@!?(?:${clientUser.id})>`, 'gi');
  return content.replace(mentionPattern, '').trim();
}

function createDiscordGateway({ botToken, channelId, automationHandler }) {
  if (!botToken) throw new Error('DISCORD_BOT_TOKEN is required for the gateway.');
  const client = new Client({
    intents: [
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.Guilds,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });
  const messenger = createDiscordMessenger({ botToken });
  const sessionStore = createSessionStore();
  const commandRegexes = loadCommands();

  client.once('clientReady', () => {
    console.log(`Discord gateway ready as ${client.user.tag}`);
  });

  client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    if (channelId && message.channel.type !== ChannelType.DM && message.channelId !== channelId) return;
    const rawContent = message.content.trim();
    const normalized = stripBotMention(rawContent, client.user).toLowerCase();
    const alreadyRunning = sessionStore.has(message.author.id);
    const matchesTrigger = commandRegexes.some((regex) => regex.test(normalized));
    const isAttachCommand = /^attach$/i.test(normalized);
    const isDm = message.channel.type === ChannelType.DM;
    const botMentioned = client.user ? message.mentions.has(client.user.id) : false;
    if (!matchesTrigger && !alreadyRunning && !isAttachCommand) {
      if (botMentioned && !normalized) {
        return messenger.sendMessage(message.channelId, 'yes?');
      }
      return;
    }
    if (!alreadyRunning && isAttachCommand && !isDm) {
      if (!botMentioned && !channelId) return;
      const session = getSession(message.author.id);
      session.stage = 'attachments';
      session.channelId = message.channelId;
      return messenger.sendMessage(
        message.channelId,
        'Send any photos/documents to attach, or type `skip` to continue without attachments.'
      );
    }
    if (alreadyRunning && matchesTrigger) {
      const session = getSession(message.author.id);
      requestRestartConfirmation(message, session);
      return;
    }
    if (!alreadyRunning && matchesTrigger && !isDm) {
      if (!botMentioned && !channelId) return;
      startDmSession(message);
      return;
    }
    if (!alreadyRunning && !isDm && !botMentioned) return;
    const userId = message.author.id;
    const session = getSession(userId);
    sessionStore.recordUserMessage(session, message);
    void handleSessionMessage(message, session);
  });

  client.login(botToken).catch((err) => {
    console.error('Failed to login Discord gateway', err);
  });

  function getSession(userId) {
    const session = sessionStore.get(userId);
    if (!STAGES.includes(session.stage)) {
      session.stage = STAGES[0];
    }
    return session;
  }

  async function startDmSession(message) {
    const userId = message.author.id;
    const session = getSession(userId);
    try {
      const dmChannel = await message.author.createDM();
      session.channelId = dmChannel.id;
      session.stage = 'portal';
      session.data = {};
      messenger.sendMessage(
        dmChannel.id,
        'Thanks—let’s continue in a DM. Send your portal URL to get started.'
      );
      if (message.channelId !== dmChannel.id) {
        messenger.sendMessage(message.channelId, 'I sent you a DM to continue this request.');
      }
    } catch (error) {
      console.warn(`Unable to open DM for user ${userId}: ${error.message}`);
      messenger.sendMessage(
        message.channelId,
        'I could not open a DM. Please send me a direct message to continue.'
      );
    }
  }

  async function handleSessionMessage(message, session) {
    if (session.channelId && message.channelId !== session.channelId) {
      return messenger.sendMessage(message.channelId, 'I sent you a DM to continue this request.');
    }
    if (!session.channelId && message.channel.type === ChannelType.DM) {
      session.channelId = message.channelId;
    }
    const clean = message.content.trim();
    if (session.pendingRestart) {
      if (/^start over$/i.test(clean) || /^yes$/i.test(clean)) {
        await cleanupSessionFiles(session);
        session.stage = 'portal';
        session.data = {};
        session.pendingRestart = false;
        return messenger.sendMessage(message.channelId, 'Okay, starting over. Send your portal URL to get started.');
      }
      if (/^(continue|keep going|no)$/i.test(clean)) {
        session.pendingRestart = false;
        return messenger.sendMessage(message.channelId, promptForStage(session));
      }
      return messenger.sendMessage(
        message.channelId,
        'Type `start over` to restart or `continue` to keep your current request.'
      );
    }
    if (/^cancel$/i.test(clean)) {
      await cleanupSessionFiles(session);
      sessionStore.remove(message.author.id);
      return messenger.sendMessage(message.channelId, 'Session cancelled. Send “new request” to restart.');
    }
    if (/^attach$/i.test(clean)) {
      session.stage = 'attachments';
      return messenger.sendMessage(
        message.channelId,
        'Send any photos/documents to attach, or type `skip` to continue without attachments.'
      );
    }
    if (/^more info$/i.test(clean)) {
      session.stage = 'remediation';
      return messenger.sendMessage(
        message.channelId,
        'Please provide the extra information requested. Type `done` when finished.'
      );
    }

    switch (session.stage) {
      case 'portal':
        session.data.portalUrl = clean;
        session.stage = 'username';
        return messenger.sendMessage(message.channelId, 'Great—what is your portal username?');
      case 'username':
        session.data.username = clean;
        session.stage = 'password';
        return messenger.sendMessage(message.channelId, 'Now send the password (it will be encrypted).');
      case 'password':
        session.data.password = clean;
        session.stage = 'issue';
        return messenger.sendMessage(message.channelId, 'Describe the maintenance issue.');
      case 'issue':
        session.data.issueDescription = clean;
        session.stage = 'attachments';
        return messenger.sendMessage(
          message.channelId,
          'If you have photos or documents to attach, send them now. Type `skip` to continue without attachments.'
        );
      case 'attachments': {
        const attachments = extractAttachments(message);
        if (attachments.length) {
          await persistAttachments(session, attachments);
          const summary = attachments.map((item) => item.filename || 'attachment').join(', ');
          return messenger.sendMessage(
            message.channelId,
            `Saved ${attachments.length} attachment(s): ${summary}. Send more or type \`done\` to continue.`
          );
        }
        if (/^(skip|done)$/i.test(clean)) {
          await echoAttachments(message.channelId, session);
          const summary = formatAttachmentSummary(session);
          session.stage = 'confirm';
          return messenger.sendMessage(
            message.channelId,
            summary ||
              'No attachments saved. Type `yes` to submit the request or `cancel` to abort.'
          );
        }
        return messenger.sendMessage(
          message.channelId,
          'Please attach images/documents, or type `skip` to continue.'
        );
      }
      case 'confirm':
        if (/^yes$/i.test(clean)) {
          return runAutomation(message.channelId, session);
        }
        messenger.sendMessage(message.channelId, 'Type `yes` when you’re ready or `cancel` to stop.');
        return;
      case 'remediation':
        return handleRemediation(message, session);
      default:
        session.stage = 'portal';
        return messenger.sendMessage(message.channelId, 'Send your portal URL to get started.');
    }
  }

  function promptForStage(session) {
    switch (session.stage) {
      case 'portal':
        return 'Send your portal URL to get started.';
      case 'username':
        return 'What is your portal username?';
      case 'password':
        return 'Send the password when you are ready.';
      case 'issue':
        return 'Describe the maintenance issue.';
      case 'attachments':
        return 'Send any photos or type `skip` to continue.';
      case 'remediation':
        return 'Please provide the extra information requested.';
      case 'confirm':
        return 'Type `yes` to submit the request or `cancel` to abort.';
      default:
        return 'Send your portal URL to get started.';
    }
  }

  function requestRestartConfirmation(message, session) {
    if (!session.channelId && message.channel.type === ChannelType.DM) {
      session.channelId = message.channelId;
    }
    session.pendingRestart = true;
    const targetChannelId = session.channelId || message.channelId;
    messenger.sendMessage(
      targetChannelId,
      'You already have a request in progress. Type `start over` to restart or `continue` to keep going.'
    );
    if (targetChannelId !== message.channelId) {
      messenger.sendMessage(message.channelId, 'I sent you a DM to continue this request.');
    }
  }

  function extractAttachments(message) {
    if (!message.attachments || message.attachments.size === 0) return [];
    return Array.from(message.attachments.values())
      .map((attachment) => ({
        url: attachment.url,
        filename: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
      }))
      .filter((attachment) => attachment.url);
  }

  async function persistAttachments(session, attachments) {
    if (!session.data.attachments) session.data.attachments = [];
    if (!session.tempDir) {
      const repoRoot = path.resolve(__dirname, '../..');
      session.tempDir = path.join(repoRoot, 'tmp', 'attachments', session.id);
      await fs.promises.mkdir(session.tempDir, { recursive: true });
    }

    const saved = await Promise.all(
      attachments.map((attachment) => downloadAttachment(session.tempDir, attachment))
    );
    for (const entry of saved) {
      if (entry) session.data.attachments.push(entry);
    }
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

  async function cleanupSessionFiles(session) {
    if (session.tempDir) {
      try {
        await fs.promises.rm(session.tempDir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`Failed to cleanup temp dir ${session.tempDir}: ${err.message}`);
      }
    }
  }

  async function handleRemediation(message, session) {
    const attachments = extractAttachments(message);
    if (attachments.length) {
      await persistAttachments(session, attachments);
      return messenger.sendMessage(
        message.channelId,
        `Saved ${attachments.length} attachment(s). Send more or type \`done\` to continue.`
      );
    }
    const clean = message.content.trim();
    if (/^done$/i.test(clean)) {
      return runAutomation(message.channelId, session);
    }
    sessionStore.recordExtra(session, clean);
    return messenger.sendMessage(
      message.channelId,
      'Noted. Send more details or type `done` when finished.'
    );
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
    if (data.MISSING) {
      try {
        data.missing = JSON.parse(data.MISSING);
      } catch {
        data.missing = data.MISSING;
      }
    }
    return data;
  }

  function outcomePrompt(outcome) {
    if (outcome.prompt) return outcome.prompt;
    if (outcome.reason) return outcome.reason;
    return 'Unable to submit the request. Please try again later.';
  }

  async function runAutomation(channelId, session) {
    try {
      const result = await automationHandler.run(session.data);
      const outcome = parseOutcome(result);

      if (outcome.status === 'SUCCESS' || result.success) {
        messenger.sendMessage(channelId, 'Request submitted successfully.');
        if (result.confirmation) {
          messenger.sendImage(channelId, result.confirmation, 'Confirmation image');
        }
        await cleanupSessionFiles(session);
        sessionStore.remove(session.userId);
        return;
      }

      if (outcome.action === 'NEEDS_INFO') {
        session.stage = 'remediation';
        session.data.missing = outcome.missing || outcome.reason;
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

  async function echoAttachments(channelId, session) {
    if (!session.data.attachments || session.data.attachments.length === 0) return;
    const valid = session.data.attachments.filter((item) => item.path);
    if (valid.length === 0) {
      return messenger.sendMessage(channelId, 'No saved attachments were available to echo.');
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

  return { client };
}

module.exports = { createDiscordGateway };
