import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadConfig } from './config.js';
import type { AIProvider } from './types.js';

export interface ArticleSummary {
  headline: string;
  tldr: string;
  keyPoints: string[];
  whyItMatters: string;
  keyQuote?: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface ModelInfo {
  id: string;
  name: string;
}

export const FALLBACK_MODELS: Record<AIProvider, ModelInfo[]> = {
  anthropic: [
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5' },
  ],
  openai: [
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
  ],
  gemini: [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  ],
};

export async function fetchModels(provider: AIProvider, apiKey: string): Promise<ModelInfo[]> {
  try {
    switch (provider) {
      case 'anthropic':
        return await fetchAnthropicModels(apiKey);
      case 'openai':
        return await fetchOpenAIModels(apiKey);
      case 'gemini':
        return await fetchGeminiModels(apiKey);
      default:
        return [];
    }
  } catch (error) {
    console.error('Failed to fetch models:', error instanceof Error ? error.message : error);
    return [];
  }
}

async function fetchAnthropicModels(apiKey: string): Promise<ModelInfo[]> {
  const response = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const data = await response.json() as { data: Array<{ id: string; display_name: string }> };
  
  return data.data
    .filter(m => m.id.includes('claude') && !m.id.includes('instant'))
    .map(m => ({ id: m.id, name: m.display_name || m.id }));
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const data = await response.json() as { data: Array<{ id: string }> };
  
  const validPrefixes = ['gpt-4', 'gpt-5', 'o1', 'o3', 'o4'];
  const excludePatterns = ['realtime', 'audio', 'vision', 'instruct', 'turbo', 'preview'];
  
  return data.data
    .filter(m => {
      const id = m.id.toLowerCase();
      const hasValidPrefix = validPrefixes.some(p => id.startsWith(p));
      const hasExcluded = excludePatterns.some(p => id.includes(p));
      return hasValidPrefix && !hasExcluded;
    })
    .map(m => ({ id: m.id, name: m.id }))
    .sort((a, b) => b.id.localeCompare(a.id));
}

async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const data = await response.json() as { models: Array<{ name: string; displayName: string; supportedGenerationMethods: string[] }> };
  
  return data.models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .filter(m => m.name.includes('gemini'))
    .map(m => ({
      id: m.name.replace('models/', ''),
      name: m.displayName || m.name.replace('models/', ''),
    }))
    .sort((a, b) => {
      const aVersion = a.id.match(/\d+(\.\d+)?/)?.[0] || '0';
      const bVersion = b.id.match(/\d+(\.\d+)?/)?.[0] || '0';
      return parseFloat(bVersion) - parseFloat(aVersion);
    });
}

export function serializeSummary(summary: ArticleSummary): string {
  return JSON.stringify(summary);
}

export function parseSummary(summaryStr: string | undefined): ArticleSummary | null {
  if (!summaryStr) return null;
  try {
    const parsed = JSON.parse(summaryStr);
    if (parsed.headline && parsed.tldr) {
      return parsed as ArticleSummary;
    }
    return {
      headline: parsed.hook || summaryStr,
      tldr: parsed.summary || summaryStr,
      keyPoints: [],
      whyItMatters: '',
      tags: parsed.tags || [],
      difficulty: parsed.difficulty || 'intermediate',
    };
  } catch {
    return {
      headline: summaryStr,
      tldr: summaryStr,
      keyPoints: [],
      whyItMatters: '',
      tags: [],
      difficulty: 'intermediate',
    };
  }
}

function buildPrompt(title: string, content: string, url: string, language: string): string {
  return `You are a SENIOR TECH JOURNALIST at a prestigious developer magazine.
Your job is to create compelling, newspaper-style briefings that developers actually want to read.

---

INPUT:
- Title: ${title}
- URL: ${url}
- Content: ${content.substring(0, 6000)}

---

TASK: Create a briefing in JSON format.

{
  "headline": "Catchy, newspaper-style headline (max 15 words)",
  "tldr": "One-sentence summary for busy readers",
  "keyPoints": [
    "First key point (one sentence)",
    "Second key point (one sentence)", 
    "Third key point (one sentence)"
  ],
  "whyItMatters": "Why this matters to developers/readers (1-2 sentences)",
  "keyQuote": "Most impactful quote from the article (if any, otherwise empty string)",
  "tags": ["tag1", "tag2", "tag3"],
  "difficulty": "beginner|intermediate|advanced"
}

---

CRITICAL RULES:
1. WRITE EVERYTHING IN ${language}. This is NOT optional. The output MUST be in ${language}.
2. Headline should be ATTENTION-GRABBING but accurate—no clickbait lies.
3. Key points should be ACTIONABLE insights, not just descriptions.
4. Tags: use technical topics (frontend, backend, ai, devops, database, security, career, etc.)
5. Difficulty: beginner (anyone can understand), intermediate (some experience needed), advanced (experts only)

OUTPUT: JSON only, no explanation outside JSON.`;
}

async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0]?.message?.content || '';
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });
  const result = await geminiModel.generateContent(prompt);
  return result.response.text();
}

export async function summarizeArticle(
  title: string,
  content: string,
  url: string
): Promise<ArticleSummary> {
  const config = loadConfig();
  
  if (!config.ai.apiKey) {
    return getDefaultSummary(title, url);
  }

  const provider = config.ai.provider;
  const model = config.ai.model;
  const language = config.ai.language || 'English';
  const prompt = buildPrompt(title, content, url, language);

  try {
    let text = '';
    
    switch (provider) {
      case 'anthropic':
        text = await callAnthropic(config.ai.apiKey, model, prompt);
        break;
      case 'openai':
        text = await callOpenAI(config.ai.apiKey, model, prompt);
        break;
      case 'gemini':
        text = await callGemini(config.ai.apiKey, model, prompt);
        break;
      default:
        return getDefaultSummary(title, url);
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultSummary(title, url);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      headline: parsed.headline || title,
      tldr: parsed.tldr || '',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 3) : [],
      whyItMatters: parsed.whyItMatters || '',
      keyQuote: parsed.keyQuote || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      difficulty: ['beginner', 'intermediate', 'advanced'].includes(parsed.difficulty) 
        ? parsed.difficulty 
        : 'intermediate',
    };
  } catch (error) {
    console.error('AI summarization failed:', error);
    return getDefaultSummary(title, url);
  }
}

function getDefaultSummary(title: string, url: string): ArticleSummary {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.replace('www.', '');
  } catch {
    hostname = 'unknown';
  }
  
  const tags: string[] = [];
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('github.com')) tags.push('github');
  if (urlLower.includes('medium.com')) tags.push('blog');
  if (urlLower.includes('dev.to')) tags.push('blog');
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) tags.push('video');
  if (urlLower.includes('linkedin.com')) tags.push('linkedin');
  if (urlLower.includes('news.hada.io')) tags.push('news');
  
  return {
    headline: title || `Article from ${hostname}`,
    tldr: title || `Content from ${hostname}`,
    keyPoints: [],
    whyItMatters: '',
    tags,
    difficulty: 'intermediate',
  };
}
