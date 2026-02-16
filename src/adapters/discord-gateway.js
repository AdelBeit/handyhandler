const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, ChannelType, Partials } = require('discord.js');
const { createDiscordMessenger } = require('../integrations/messaging/discord');
const { createSessionStore } = require('../core/session-store');
const { createRequestStore } = require('../core/request-store');
const { createSessionFlow } = require('../core/session-flow');
const { FLOW_MESSAGES } = require('../core/flow-messages');

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

function mapDiscordAttachments(attachments) {
  if (!attachments || attachments.size === 0) return [];
  return Array.from(attachments.values()).map((attachment) => ({
    url: attachment.url,
    filename: attachment.name,
    contentType: attachment.contentType,
    size: attachment.size,
  }));
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
  const requestStore = createRequestStore();
  const flow = createSessionFlow({
    sessionStore,
    automationHandler,
    messenger,
    requestStore,
    repoRoot: path.resolve(__dirname, '../..'),
  });
  const commandRegexes = loadCommands();

  client.once('clientReady', () => {
    console.log(`Discord gateway ready as ${client.user.tag}`);
  });

  client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    if (channelId && message.channel.type !== ChannelType.DM && message.channelId !== channelId) return;
    const rawContent = message.content.trim();
    const stripped = stripBotMention(rawContent, client.user).trim();
    const normalized = stripped.toLowerCase();
    const alreadyRunning = sessionStore.has(message.author.id);
    const matchesTrigger = commandRegexes.some((regex) => regex.test(normalized));
    const isAttachCommand = /^attach$/i.test(normalized);
    const statusCommand = parseStatusCommand(stripped);
    const isDm = message.channel.type === ChannelType.DM;
    const botMentioned = client.user ? message.mentions.has(client.user.id) : false;

    if (!matchesTrigger && !alreadyRunning && !isAttachCommand && !statusCommand) {
      if (botMentioned && !normalized) {
        return messenger.sendMessage(message.channelId, FLOW_MESSAGES.yesPrompt);
      }
      return;
    }

    if (statusCommand) {
      if (!isDm && !botMentioned && !channelId) return;
      handleStatusCommand({
        command: statusCommand,
        message,
        requestStore,
        messenger,
      });
      return;
    }

    if (!alreadyRunning && isAttachCommand && !isDm) {
      if (!botMentioned && !channelId) return;
      const session = sessionStore.get(message.author.id);
      session.stage = 'attachments';
      session.channelId = message.channelId;
      return messenger.sendMessage(message.channelId, FLOW_MESSAGES.attachmentSendPrompt);
    }

    if (alreadyRunning && matchesTrigger) {
      const session = sessionStore.get(message.author.id);
      requestRestartConfirmation(message, session, messenger);
      return;
    }

    if (!alreadyRunning && matchesTrigger) {
      if (!isDm) {
        if (!botMentioned && !channelId) return;
        startDmSession(message, sessionStore, messenger);
        return;
      }
      const session = sessionStore.get(message.author.id);
      session.stage = 'portal';
      session.channelId = message.channelId;
      messenger.sendMessage(message.channelId, FLOW_MESSAGES.portalPrompt);
      return;
    }

    if (!alreadyRunning && !isDm && !botMentioned) return;

    const session = sessionStore.get(message.author.id);
    if (session.channelId && message.channelId !== session.channelId) {
      messenger.sendMessage(message.channelId, FLOW_MESSAGES.dmContinue);
      return;
    }
    if (!session.channelId && isDm) {
      session.channelId = message.channelId;
    }

    sessionStore.recordUserMessage(session, {
      content: message.content,
      attachmentsCount: message.attachments ? message.attachments.size : 0,
    });

    const input = {
      channelId: message.channelId,
      text: message.content.trim(),
      attachments: mapDiscordAttachments(message.attachments),
    };
    void flow.handleInput(session, input);
  });

  client.login(botToken).catch((err) => {
    console.error('Failed to login Discord gateway', err);
  });

  return { client };
}

async function startDmSession(message, sessionStore, messenger) {
  const userId = message.author.id;
  const session = sessionStore.get(userId);
  try {
    const dmChannel = await message.author.createDM();
    session.channelId = dmChannel.id;
    session.stage = 'portal';
    session.data = {};
    messenger.sendMessage(dmChannel.id, FLOW_MESSAGES.dmStart);
    if (message.channelId !== dmChannel.id) {
      messenger.sendMessage(message.channelId, FLOW_MESSAGES.dmContinue);
    }
  } catch (error) {
    console.warn(`Unable to open DM for user ${userId}: ${error.message}`);
    messenger.sendMessage(
      message.channelId,
      FLOW_MESSAGES.dmFailed
    );
  }
}

function requestRestartConfirmation(message, session, messenger) {
  if (!session.channelId && message.channel.type === ChannelType.DM) {
    session.channelId = message.channelId;
  }
  session.pendingRestart = true;
  const targetChannelId = session.channelId || message.channelId;
  messenger.sendMessage(targetChannelId, FLOW_MESSAGES.restartPrompt);
  if (targetChannelId !== message.channelId) {
    messenger.sendMessage(message.channelId, FLOW_MESSAGES.dmContinue);
  }
}

module.exports = { createDiscordGateway };

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

function handleStatusCommand({ command, message, requestStore, messenger }) {
  const userId = message.author.id;
  if (command.type === 'list') {
    const filter = command.filter || 'open';
    const requests = requestStore.list(userId, filter);
    const response = formatStatusList(filter, requests);
    messenger.sendMessage(message.channelId, response);
    return;
  }

  const request = requestStore.findById(userId, command.query);
  if (!request) {
    messenger.sendMessage(
      message.channelId,
      'I could not find that request. Reply `status` to see open requests or `status all` to list everything.'
    );
    return;
  }
  messenger.sendMessage(message.channelId, formatStatusDetail(request));
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
