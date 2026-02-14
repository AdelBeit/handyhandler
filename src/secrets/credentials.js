const fs = require('fs');
const path = require('path');

function resolveCredentialsPath(filePath) {
  if (filePath) return filePath;
  return path.join(process.cwd(), 'data', 'credentials.json');
}

function loadCredentials(filePath) {
  const resolved = resolveCredentialsPath(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Credentials file not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error('Credentials file contains invalid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.records)) {
    throw new Error('Credentials file must contain a records array.');
  }
  return parsed;
}

function getCredentialById(id, filePath) {
  if (!id) {
    throw new Error('Credential id is required.');
  }
  const { records } = loadCredentials(filePath);
  const match = records.find((record) => record && record.id === id);
  return match || null;
}

module.exports = {
  loadCredentials,
  getCredentialById,
};
