const STATUS = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED',
};

function createRequestStore() {
  const requestsByUser = new Map();

  function ensureList(userId) {
    if (!requestsByUser.has(userId)) {
      requestsByUser.set(userId, []);
    }
    return requestsByUser.get(userId);
  }

  function createRequestId() {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `REQ-${stamp}-${suffix}`;
  }

  function normalizeStatus(value) {
    if (!value) return STATUS.OPEN;
    const upper = String(value).toUpperCase();
    if (upper === STATUS.RESOLVED) return STATUS.RESOLVED;
    if (upper === STATUS.CANCELLED) return STATUS.CANCELLED;
    return STATUS.OPEN;
  }

  function recordSuccess({ userId, portalUrl, issueDescription, confirmation, channelId }) {
    if (!userId) return null;
    const now = new Date().toISOString();
    const request = {
      id: createRequestId(),
      userId,
      portalUrl: portalUrl || null,
      issueDescription: issueDescription || null,
      confirmation: confirmation || null,
      channelId: channelId || null,
      status: STATUS.OPEN,
      createdAt: now,
      updatedAt: now,
    };
    const list = ensureList(userId);
    list.unshift(request);
    return request;
  }

  function updateStatus(userId, requestId, status) {
    if (!userId || !requestId) return null;
    const list = ensureList(userId);
    const normalizedId = requestId.toUpperCase();
    const request = list.find((item) => item.id === normalizedId);
    if (!request) return null;
    request.status = normalizeStatus(status);
    request.updatedAt = new Date().toISOString();
    return request;
  }

  function findById(userId, query) {
    if (!userId || !query) return null;
    const list = ensureList(userId);
    const normalized = query.trim().toUpperCase();
    const exact = list.find((item) => item.id === normalized);
    if (exact) return exact;
    return list.find((item) => item.id.endsWith(normalized));
  }

  function list(userId, filter) {
    if (!userId) return [];
    const list = ensureList(userId);
    const normalized = filter ? String(filter).toUpperCase() : 'OPEN';
    if (normalized === 'ALL') return [...list];
    const target = normalizeStatus(normalized);
    return list.filter((item) => item.status === target);
  }

  return {
    STATUS,
    recordSuccess,
    updateStatus,
    findById,
    list,
  };
}

module.exports = { createRequestStore };
