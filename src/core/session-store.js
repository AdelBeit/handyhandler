const { createSessionData } = require('./session-data');

function createSessionStore() {
  const sessions = new Map();

  function createSession(userId) {
    const now = new Date().toISOString();
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      createdAt: now,
      updatedAt: now,
      stage: 'portal',
      channelId: null,
      pendingRestart: false,
      tempDir: null,
      data: createSessionData(),
    };
  }

  function get(userId) {
    if (!sessions.has(userId)) {
      sessions.set(userId, createSession(userId));
    }
    return sessions.get(userId);
  }

  function has(userId) {
    return sessions.has(userId);
  }

  function touch(session) {
    session.updatedAt = new Date().toISOString();
  }

  function recordUserMessage(session, message) {
    const entry = {
      at: new Date().toISOString(),
      type: 'user',
      content: message.content || '',
      attachments: message.attachmentsCount || 0,
    };
    session.data.history.push(entry);
    session.data.responses.push({
      at: entry.at,
      content: message.content,
    });
    touch(session);
  }

  function recordExtra(session, text) {
    session.data.extras.push({ at: new Date().toISOString(), content: text });
    touch(session);
  }

  function remove(userId) {
    sessions.delete(userId);
  }

  return {
    get,
    has,
    remove,
    recordUserMessage,
    recordExtra,
    touch,
  };
}

module.exports = { createSessionStore };
