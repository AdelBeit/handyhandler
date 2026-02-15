const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, ChannelType, Partials } = require('discord.js');
const { createDiscordMessenger } = require('../integrations/messaging/discord');
const { createSessionStore } = require('../core/session-store');
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
  const flow = createSessionFlow({
    sessionStore,
    automationHandler,
    messenger,
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
    const normalized = stripBotMention(rawContent, client.user).toLowerCase();
    const alreadyRunning = sessionStore.has(message.author.id);
    const matchesTrigger = commandRegexes.some((regex) => regex.test(normalized));
    const isAttachCommand = /^attach$/i.test(normalized);
    const isDm = message.channel.type === ChannelType.DM;
    const botMentioned = client.user ? message.mentions.has(client.user.id) : false;

    if (!matchesTrigger && !alreadyRunning && !isAttachCommand) {
      if (botMentioned && !normalized) {
        return messenger.sendMessage(message.channelId, FLOW_MESSAGES.yesPrompt);
      }
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
