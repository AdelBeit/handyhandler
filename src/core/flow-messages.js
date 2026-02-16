const FLOW_MESSAGES = {
  yesPrompt: 'yes?',
  dmStart: 'Thanks—let’s continue in a DM. Send your portal URL to get started.',
  dmStartV2: 'Thanks—let’s continue in a DM.',
  dmContinue: 'I sent you a DM to continue this request.',
  dmFailed: 'I could not open a DM. Please send me a direct message to continue.',
  portalPrompt: 'Send your portal URL to get started.',
  usernamePrompt: 'Great—what is your portal username?',
  passwordPrompt: 'Now send the password (it will be encrypted).',
  issuePrompt: 'Describe the maintenance issue.',
  attachmentPrompt:
    'If you have photos or documents to attach, send them now. Type `skip` to continue without attachments.',
  attachmentSendPrompt: 'Send any photos/documents to attach, or type `skip` to continue without attachments.',
  attachmentSaved: (count, summary) =>
    `Saved ${count} attachment(s): ${summary}. Send more or type \`done\` to continue.`,
  attachmentSavedRemediation: (count) =>
    `Saved ${count} attachment(s). Send more or type \`done\` to continue.`,
  attachmentNoneSaved: 'No attachments saved. Type `yes` to submit the request or `cancel` to abort.',
  attachmentAwait: 'Please attach images/documents, or type `skip` to continue.',
  attachmentEchoMissing: 'No saved attachments were available to echo.',
  confirmPrompt: 'Thanks! Type `yes` to submit the request or `cancel` to abort.',
  confirmReadyPrompt: 'Type `yes` when you’re ready or `cancel` to stop.',
  restartPrompt:
    'You already have a request in progress. Type `start over` to restart or `continue` to keep going.',
  restartHelp: 'Type `start over` to restart or `continue` to keep your current request.',
  startOver: 'Okay, starting over. Send your portal URL to get started.',
  cancelled: 'Session cancelled. Send “new request” to restart.',
  remediationPrompt:
    'Hey! I still need a bit more info to finish the request. Please share the missing details or attachments. Type `done` when finished.',
  remediationNoted: 'Got it. Send any other details or type `done` when finished.',
  remediationDone: 'Thanks! Type `yes` to submit the request or `cancel` to abort.',
  remediationProposal: (field, value) =>
    `I wasn't given ${field}. I think it should be "${value}". Reply \`yes\` to accept or \`no\` to choose another option.`,
  remediationOptions: (field, options) =>
    `Please choose a value for ${field}. Options: ${options.join(', ')}.`,
  remediationInvalidOption: 'That option isn’t in the list I can accept.',
  remediationOptionsHint: 'Reply with one of the listed options or type `options` to see them again.',
  remediationConfirmHint: 'Reply `yes` to accept or `no` to choose another option.',
  requestSubmitted: 'Request submitted successfully.',
  automationFailed: 'Unable to submit the request. Please try again later.',
  confirmationImageLabel: 'Confirmation image',
  v2BulkPrompt:
    'Hey! I can file the maintenance request for you. Please reply in this exact format:\nportal_url, username, password, issue\nExample: https://example.com, alex@email.com, pass123, AC not cooling',
  v2AttachmentOnlyPrompt: 'The only response I got was a picture. Please answer the questions.',
  v2ConfirmPrompt: 'I got this info from you. Ready to submit it?',
  v2ConfirmReadyPrompt: 'Reply `yes`, `submit`, or `ok` to submit, or `cancel` to abort.',
};

module.exports = { FLOW_MESSAGES };
