/**
 * @typedef {Object} AutomationRequest
 * @property {string} portalUrl
 * @property {string} goal - The automation instructions. Used for both submission and bulk-intake extraction.
 * @property {Object} [credentials]
 * @property {Object} [issue]
 * @property {Object} [extras]
 */

/**
 * @typedef {Object} AutomationResult
 * @property {boolean} success
 * @property {string} [confirmation]
 * @property {Object} [raw]
 * @property {Array<Object>} [events]
 */

function validateAutomationRequest(req) {
  if (!req || typeof req !== 'object') {
    throw new Error('Automation request must be an object.');
  }
  if (!req.portalUrl || typeof req.portalUrl !== 'string') {
    throw new Error('Automation request requires portalUrl.');
  }
  if (!req.goal || typeof req.goal !== 'string') {
    throw new Error('Automation request requires goal.');
  }
}

function isBulkIntakeGoal(goal) {
  if (!goal || typeof goal !== 'string') return false;
  return goal.includes('USER_MESSAGE:');
}

module.exports = {
  validateAutomationRequest,
  isBulkIntakeGoal,
};
