import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from './config.js';

export interface ArticleSummary {
  headline: string;
  tldr: string;
  keyPoints: string[];
  whyItMatters: string;
  keyQuote?: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
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

export async function summarizeArticle(
  title: string,
  content: string,
  url: string
): Promise<ArticleSummary> {
  const config = loadConfig();
  
  if (!config.ai.apiKey) {
    return getDefaultSummary(title, url);
  }

  const client = new Anthropic({ apiKey: config.ai.apiKey });

  const prompt = `You are a tech journalist. Analyze this article and create a newspaper-style briefing.

Title: ${title}
URL: ${url}
Content: ${content.substring(0, 6000)}

Respond in JSON format only:
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

Guidelines:
- Write in the SAME LANGUAGE as the article
- Headline should be attention-grabbing but accurate
- Key points should be actionable insights, not just descriptions
- Tags: use technical topics (frontend, backend, ai, devops, database, security, career, etc.)
- Make it feel like a professional tech newsletter`;

  try {
    const response = await client.messages.create({
      model: config.ai.model,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    
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
