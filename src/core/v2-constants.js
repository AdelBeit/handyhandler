const REQUIRED_FIELDS = [
  { key: 'portalUrl', label: 'portal URL' },
  { key: 'username', label: 'username' },
  { key: 'password', label: 'password' },
  { key: 'issueDescription', label: 'issue description' },
];

const REQUIRED_FIELD_KEYS = REQUIRED_FIELDS.map((field) => field.key);
const REQUIRED_FIELD_LABELS = REQUIRED_FIELDS.map((field) => field.label);
const REQUIRED_FIELD_LABEL_BY_KEY = Object.fromEntries(
  REQUIRED_FIELDS.map((field) => [field.key, field.label])
);

module.exports = {
  REQUIRED_FIELDS,
  REQUIRED_FIELD_KEYS,
  REQUIRED_FIELD_LABELS,
  REQUIRED_FIELD_LABEL_BY_KEY,
};
