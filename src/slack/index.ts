export { SlackClient } from './client.js';
export type { SlackAuthConfig, SlackUser, SlackConversation, SlackMessage } from './client.js';
export { addSlackSource, listSlackSources, removeSlackSource, addChannelToSource, removeChannelFromSource } from './auth.js';
export { syncSlackSources } from './sync.js';
export type { SyncResult } from './sync.js';
