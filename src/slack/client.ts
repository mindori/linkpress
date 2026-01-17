import crypto from 'crypto';

export interface SlackAuthConfig {
  token: string;
  cookie: string;
}

export interface SlackUser {
  id: string;
  name: string;
  realName: string;
}

export interface SlackConversation {
  id: string;
  name: string;
  isPrivate: boolean;
  isIm: boolean;
  isMpim: boolean;
  user?: string;
}

export interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  type: string;
}

export class SlackClient {
  private token: string;
  private cookie: string;
  private baseUrl = 'https://slack.com/api';

  constructor(auth: SlackAuthConfig) {
    this.token = auth.token;
    this.cookie = auth.cookie;
  }

  private async request<T>(method: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}/${method}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Cookie': `d=${this.cookie}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    const data = await response.json() as { ok: boolean; error?: string } & T;
    
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
    }

    return data;
  }

  async testAuth(): Promise<SlackUser> {
    const response = await this.request<{ user_id: string; user: string; team: string }>('auth.test');
    return {
      id: response.user_id,
      name: response.user,
      realName: response.user,
    };
  }

  async getConversations(): Promise<SlackConversation[]> {
    const conversations: SlackConversation[] = [];
    let cursor: string | undefined;

    do {
      const params: Record<string, string> = {
        types: 'public_channel,private_channel,mpim,im',
        limit: '200',
        exclude_archived: 'true',
      };
      
      if (cursor) {
        params.cursor = cursor;
      }

      const response = await this.request<{
        channels: Array<{
          id: string;
          name?: string;
          is_private: boolean;
          is_im: boolean;
          is_mpim: boolean;
          user?: string;
        }>;
        response_metadata?: { next_cursor?: string };
      }>('conversations.list', params);

      for (const channel of response.channels) {
        conversations.push({
          id: channel.id,
          name: channel.name || channel.id,
          isPrivate: channel.is_private,
          isIm: channel.is_im,
          isMpim: channel.is_mpim,
          user: channel.user,
        });
      }

      cursor = response.response_metadata?.next_cursor;
    } while (cursor);

    return conversations;
  }

  async getUserInfo(userId: string): Promise<{ id: string; name: string; realName: string }> {
    const response = await this.request<{
      user: { id: string; name: string; real_name: string };
    }>('users.info', { user: userId });

    return {
      id: response.user.id,
      name: response.user.name,
      realName: response.user.real_name,
    };
  }

  async getConversationHistory(
    channelId: string,
    options: { limit?: number; oldest?: string; latest?: string } = {}
  ): Promise<SlackMessage[]> {
    const messages: SlackMessage[] = [];
    let cursor: string | undefined;
    let fetched = 0;
    const limit = options.limit || 100;

    do {
      const params: Record<string, string> = {
        channel: channelId,
        limit: Math.min(limit - fetched, 200).toString(),
      };

      if (cursor) params.cursor = cursor;
      if (options.oldest) params.oldest = options.oldest;
      if (options.latest) params.latest = options.latest;

      const response = await this.request<{
        messages: SlackMessage[];
        response_metadata?: { next_cursor?: string };
      }>('conversations.history', params);

      messages.push(...response.messages);
      fetched += response.messages.length;
      cursor = response.response_metadata?.next_cursor;
    } while (cursor && fetched < limit);

    return messages;
  }

  generateSourceId(): string {
    return crypto.randomUUID();
  }
}
