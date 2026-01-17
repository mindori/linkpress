export interface Article {
  id: string;
  url: string;
  title: string;
  description?: string;
  content?: string;
  summary?: string;
  tags: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  readingTimeMinutes?: number;
  sourceType: 'slack' | 'manual' | 'import';
  sourceId?: string;
  createdAt: Date;
  processedAt?: Date;
}

export interface SlackSource {
  id: string;
  workspace: string;
  token: string;
  cookie: string;
  channels: SlackChannel[];
  addedAt: Date;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isSelfDM: boolean;
}

export type AIProvider = 'anthropic' | 'openai' | 'gemini';

export interface Config {
  sources: {
    slack?: SlackSource[];
  };
  ai: {
    provider: AIProvider;
    apiKey?: string;
    model: string;
    language: string;
  };
  output: {
    directory: string;
    format: 'html' | 'markdown' | 'both';
  };
}

export interface Magazine {
  id: string;
  title: string;
  generatedAt: Date;
  articles: Article[];
  period: {
    from: Date;
    to: Date;
  };
}

export interface CommandContext {
  configDir: string;
  config: Config;
  db: unknown;
}
