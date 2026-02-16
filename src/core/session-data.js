function createSessionData() {
  return {
    attachments: [],
    extras: [],
    responses: [],
    history: [],
  };
}

function ensureSessionData(session) {
  if (!session.data || typeof session.data !== 'object') {
    session.data = createSessionData();
    return;
  }
  if (!Array.isArray(session.data.attachments)) session.data.attachments = [];
  if (!Array.isArray(session.data.extras)) session.data.extras = [];
  if (!Array.isArray(session.data.responses)) session.data.responses = [];
  if (!Array.isArray(session.data.history)) session.data.history = [];
}

module.exports = { createSessionData, ensureSessionData };
