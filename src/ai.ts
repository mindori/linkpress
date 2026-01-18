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

export type ContentType = 'article' | 'announcement' | 'discussion' | 'reference' | 'social' | 'media' | 'internal' | 'other';
export type TechnicalDepth = 'none' | 'shallow' | 'moderate' | 'deep' | 'expert';
export type Actionability = 'none' | 'awareness' | 'applicable' | 'reference';

export interface ContentClassification {
  contentType: ContentType;
  technicalDepth: TechnicalDepth;
  actionability: Actionability;
  shouldCollect: boolean;
  reasoning: string;
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
  const koreanRule = language === '한국어' 
    ? '\n6. KOREAN ONLY: Use formal polite speech (존댓말/합쇼체) consistently. End sentences with -습니다, -입니다, -됩니다. NEVER use casual speech (반말).'
    : '';

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
5. Difficulty: beginner (anyone can understand), intermediate (some experience needed), advanced (experts only)${koreanRule}

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

function buildClassificationPrompt(messageText: string, url: string, title: string, description: string): string {
  return `You are a SENIOR TECH EDITOR at a developer magazine.
Your job is to decide whether a shared link is worth featuring in a curated tech newsletter.
You have HIGH STANDARDS but also recognize that valuable insights come in many forms—from in-depth blog posts to concise social media threads.

---

INPUT:
- Slack Message: "${messageText}"
- Link URL: "${url}"
- Link Title: "${title}"
- Link Description: "${description}"

---

TASK: Classify this content along THREE axes.

### Axis 1: content_type
- article: Blog post, tutorial, guide, essay
- announcement: Release notes, launch posts, product updates
- discussion: HN/Reddit threads, GitHub issues, forum Q&A
- reference: API docs, RFCs, specifications, official documentation
- social: Twitter/X threads, LinkedIn posts, Threads, Mastodon
- media: YouTube videos, podcasts, conference talks
- internal: Jira, Notion, Figma, Google Docs, Slack permalinks
- other: Memes, job postings, ads, unclassifiable

### Axis 2: technical_depth
- none: NO technical content whatsoever
- shallow: Mentions tech but surface-level (news headline, brief take)
- moderate: Explains concepts, may include code snippets
- deep: Implementation details, substantial code, architecture
- expert: Novel research, new algorithms, advances the field

### Axis 3: actionability
- none: Just information, nothing to do
- awareness: Good to know, trend awareness
- applicable: Can apply immediately (how-to, tutorial)
- reference: Bookmark for later lookup

---

CRITICAL RULES:
1. DO NOT judge by content length. A 5-tweet thread can be MORE valuable than a 10-page blog post.
2. Social posts (X, LinkedIn, Threads) with technical insight ARE VALID. Many industry experts share alpha on social.
3. "shallow" depth is ACCEPTABLE. Not everything needs to be a deep dive.
4. internal links (Jira, Notion, Figma, Google Docs, Slack) are ALWAYS excluded—these are workspace tools, not content.
5. media (videos, podcasts) are EXCLUDED for now—reading-focused newsletter.
6. When in doubt about depth, lean toward INCLUSION.

---

OUTPUT FORMAT (JSON only, no explanation outside JSON):
{
  "content_type": "article|announcement|discussion|reference|social|media|internal|other",
  "technical_depth": "none|shallow|moderate|deep|expert",
  "actionability": "none|awareness|applicable|reference",
  "should_collect": true|false,
  "reasoning": "One sentence justification"
}

COLLECTION RULE:
should_collect = (content_type IN [article, announcement, discussion, reference, social]) 
                 AND (technical_depth IN [shallow, moderate, deep, expert])`;
}

export async function classifyContent(
  messageText: string,
  url: string,
  title: string,
  description: string
): Promise<ContentClassification> {
  const config = loadConfig();

  if (!config.ai.apiKey) {
    return getDefaultClassification(url);
  }

  const provider = config.ai.provider;
  const model = config.ai.model;
  const prompt = buildClassificationPrompt(messageText, url, title, description);

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
        return getDefaultClassification(url);
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultClassification(url);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const contentType = parsed.content_type as ContentType;
    const technicalDepth = parsed.technical_depth as TechnicalDepth;

    const validTypes: ContentType[] = ['article', 'announcement', 'discussion', 'reference', 'social'];
    const validDepths: TechnicalDepth[] = ['shallow', 'moderate', 'deep', 'expert'];

    const shouldCollect = validTypes.includes(contentType) && validDepths.includes(technicalDepth);

    return {
      contentType,
      technicalDepth,
      actionability: parsed.actionability as Actionability,
      shouldCollect,
      reasoning: parsed.reasoning || '',
    };
  } catch (error) {
    console.error('AI classification failed:', error);
    return getDefaultClassification(url);
  }
}

function getDefaultClassification(url: string): ContentClassification {
  const urlLower = url.toLowerCase();

  const internalPatterns = ['jira', 'notion.so', 'figma.com', 'docs.google.com', 'slack.com'];
  if (internalPatterns.some(p => urlLower.includes(p))) {
    return {
      contentType: 'internal',
      technicalDepth: 'none',
      actionability: 'none',
      shouldCollect: false,
      reasoning: 'Internal workspace tool',
    };
  }

  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return {
      contentType: 'media',
      technicalDepth: 'moderate',
      actionability: 'awareness',
      shouldCollect: false,
      reasoning: 'Video content excluded from reading-focused newsletter',
    };
  }

  return {
    contentType: 'article',
    technicalDepth: 'shallow',
    actionability: 'awareness',
    shouldCollect: true,
    reasoning: 'Default classification - assumed technical content',
  };
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
