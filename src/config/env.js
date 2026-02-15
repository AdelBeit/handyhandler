const fs = require('fs');
const path = require('path');

function parseEnvFile(contents) {
  return contents
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const [key, ...valueParts] = line.split('=');
      if (!key) return acc;
      acc[key.trim()] = valueParts.join('=').trim();
      return acc;
    }, {});
}

function loadFileEnvs() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  try {
    const contents = fs.readFileSync(envPath, 'utf8');
    return parseEnvFile(contents);
  } catch (error) {
    // Fall back to empty so missing .env does not crash
    return {};
  }
}

const fileEnv = loadFileEnvs();
const env = {
  ...fileEnv,
  ...process.env,
};

function requireEnv(key) {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

module.exports = {
  env,
  requireEnv,
};
