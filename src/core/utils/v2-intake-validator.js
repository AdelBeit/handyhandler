function parseV2CommaInput(text) {
  if (!text) return null;
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 4) return null;
  const [portalUrl, username, password, ...issueParts] = parts;
  const issueDescription = issueParts.join(', ').trim();
  if (!portalUrl || !username || !password || !issueDescription) return null;
  return { portalUrl, username, password, issueDescription };
}

module.exports = { parseV2CommaInput };
