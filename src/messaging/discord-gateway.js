const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, ChannelType, Partials } = require('discord.js');
const { createDiscordMessenger } = require('../integrations/messaging/discord');

const STAGES = ['portal', 'username', 'password', 'issue', 'confirm'];

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
  const sessions = new Map();
  const commandRegexes = loadCommands();

  client.once('clientReady', () => {
    console.log(`Discord gateway ready as ${client.user.tag}`);
  });

  client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    if (channelId && message.channel.type !== ChannelType.DM && message.channelId !== channelId) return;
    const rawContent = message.content.trim();
    const normalized = stripBotMention(rawContent, client.user).toLowerCase();
    const alreadyRunning = sessions.has(message.author.id);
    const matchesTrigger = commandRegexes.some((regex) => regex.test(normalized));
    const isDm = message.channel.type === ChannelType.DM;
    const botMentioned = client.user ? message.mentions.has(client.user.id) : false;
    if (!matchesTrigger && !alreadyRunning) {
      if (botMentioned && !normalized) {
        return messenger.sendMessage(message.channelId, 'yes?');
      }
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
    handleSessionMessage(message, session);
  });

  client.login(botToken).catch((err) => {
    console.error('Failed to login Discord gateway', err);
  });

  function getSession(userId) {
    if (!sessions.has(userId)) {
      sessions.set(userId, { stage: STAGES[0], data: {} });
    }
    return sessions.get(userId);
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

  function handleSessionMessage(message, session) {
    if (session.channelId && message.channelId !== session.channelId) {
      return messenger.sendMessage(message.channelId, 'I sent you a DM to continue this request.');
    }
    if (!session.channelId && message.channel.type === ChannelType.DM) {
      session.channelId = message.channelId;
    }
    const clean = message.content.trim();
    if (/^cancel$/i.test(clean)) {
      sessions.delete(message.author.id);
      return messenger.sendMessage(message.channelId, 'Session cancelled. Send “new request” to restart.');
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
        session.stage = 'confirm';
        return messenger.sendMessage(
          message.channelId,
          'Thanks! Type `yes` to submit the request or `cancel` to abort.'
        );
      case 'confirm':
        if (/^yes$/i.test(clean)) {
          automationHandler
            .run(session.data)
            .then((result) => {
              messenger.sendMessage(
                message.channelId,
                `Request submitted. Result: ${result.success ? 'success' : 'failure'}.`
              );
            })
            .catch((err) => {
              messenger.sendMessage(message.channelId, `Error: ${err.message}`);
            })
            .finally(() => sessions.delete(message.author.id));
        } else {
          messenger.sendMessage(message.channelId, 'Type `yes` when you’re ready or `cancel` to stop.');
        }
        return;
      default:
        session.stage = 'portal';
        return messenger.sendMessage(message.channelId, 'Send your portal URL to get started.');
    }
  }

  return { client };
}

module.exports = { createDiscordGateway };
