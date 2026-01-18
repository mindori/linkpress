export type {
  Article,
  AIProvider,
  SlackSource,
  SlackChannel,
  SlackAuthConfig,
  SlackUser,
  SlackConversation,
  SlackMessage,
  ExtractedLink,
  ScrapedContent,
  ArticleSummary,
  ContentClassification,
  ModelInfo,
  AIConfig,
} from '@linkpress/core';

export interface Config {
  sources: {
    slack?: import('@linkpress/core').SlackSource[];
  };
  ai: {
    provider: import('@linkpress/core').AIProvider;
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
  articles: import('@linkpress/core').Article[];
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
