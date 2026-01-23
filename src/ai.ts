import {
  summarizeArticle as coreSummarize,
  classifyContent as coreClassify,
  serializeSummary,
  parseSummary,
  fetchModels,
  FALLBACK_MODELS,
  type ArticleSummary,
  type ContentClassification,
  type ModelInfo,
  type AIConfig,
} from '@linkpress/core';
import { loadConfig } from './config.js';

export { serializeSummary, parseSummary, fetchModels, FALLBACK_MODELS };
export type { ArticleSummary, ContentClassification, ModelInfo };

export function getAIConfig(): AIConfig {
  const config = loadConfig();
  return {
    provider: config.ai.provider,
    apiKey: config.ai.apiKey || '',
    model: config.ai.model,
    language: config.ai.language,
  };
}

export async function summarizeArticle(
  title: string,
  content: string,
  url: string
): Promise<ArticleSummary> {
  return coreSummarize(title, content, url, getAIConfig());
}

export async function classifyContent(
  messageText: string,
  url: string,
  title: string,
  description: string
): Promise<ContentClassification> {
  return coreClassify(messageText, url, title, description, getAIConfig());
}
