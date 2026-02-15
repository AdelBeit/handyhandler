const { Client, GatewayIntentBits } = require('discord.js');
const { createDiscordMessenger } = require('../integrations/messaging/discord');

const STAGES = ['portal', 'username', 'password', 'issue', 'confirm'];

function createDiscordGateway({ botToken, channelId, automationHandler }) {
  if (!botToken) throw new Error('DISCORD_BOT_TOKEN is required for the gateway.');
  const client = new Client({
    intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds],
  });
  const messenger = createDiscordMessenger({ botToken });
  const sessions = new Map();

  client.once('ready', () => {
    console.log(`Discord gateway ready as ${client.user.tag}`);
  });

  client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    if (channelId && message.channelId !== channelId) return;
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

  function handleSessionMessage(message, session) {
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
