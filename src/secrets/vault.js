const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VAULT_PATH = path.join(process.cwd(), 'data', 'credentials.enc');
const KEY_LEN = 32;
const ALGO = 'aes-256-gcm';

function getMasterKey() {
  const key = process.env.CREDENTIALS_MASTER_KEY;
  if (!key) {
    throw new Error('CREDENTIALS_MASTER_KEY is required for the credential vault.');
  }
  const buf = Buffer.from(key, 'utf8');
  if (buf.length < KEY_LEN) {
    throw new Error('CREDENTIALS_MASTER_KEY must be at least 32 bytes.');
  }
  return buf.slice(0, KEY_LEN);
}

function encryptPayload(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), payload: encrypted.toString('base64') };
}

function decryptPayload({ iv, tag, payload }) {
  const decipher = crypto.createDecipheriv(ALGO, getMasterKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(payload, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}

function loadVault() {
  if (!fs.existsSync(VAULT_PATH)) {
    return { records: [] };
  }
  const raw = fs.readFileSync(VAULT_PATH, 'utf8');
  if (!raw) {
    return { records: [] };
  }
  const encrypted = JSON.parse(raw);
  const decoded = decryptPayload(encrypted);
  return JSON.parse(decoded);
}

function saveVault(state) {
  const payload = JSON.stringify(state);
  const encrypted = encryptPayload(payload);
  fs.writeFileSync(VAULT_PATH, JSON.stringify(encrypted), 'utf8');
}

function ensureId(record) {
  if (!record.id) {
    throw new Error('Credential record requires an id.');
  }
}

function getAll() {
  const { records } = loadVault();
  return records;
}

function getById(id) {
  return getAll().find((r) => r && r.id === id) || null;
}

function put(record) {
  ensureId(record);
  const state = loadVault();
  const existing = state.records.findIndex((r) => r.id === record.id);
  if (existing !== -1) {
    state.records[existing] = record;
  } else {
    state.records.push(record);
  }
  saveVault(state);
}

module.exports = {
  loadVault,
  saveVault,
  getAll,
  getById,
  put,
};
