import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from './config.js';

export interface ArticleSummary {
  summary: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  hook: string;
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

  const prompt = `Analyze this technical article and provide a structured summary.

Title: ${title}
URL: ${url}
Content (truncated): ${content.substring(0, 5000)}

Respond in JSON format only:
{
  "summary": "3-sentence summary of key points",
  "tags": ["tag1", "tag2", "tag3"],
  "difficulty": "beginner|intermediate|advanced",
  "hook": "One compelling sentence why someone should read this"
}

Tags should be technical topics like: frontend, backend, devops, ai, database, security, performance, architecture, career, etc.
Keep summary and hook concise and in the same language as the article.`;

  try {
    const response = await client.messages.create({
      model: config.ai.model,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultSummary(title, url);
    }

    const parsed = JSON.parse(jsonMatch[0]) as ArticleSummary;
    
    return {
      summary: parsed.summary || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      difficulty: ['beginner', 'intermediate', 'advanced'].includes(parsed.difficulty) 
        ? parsed.difficulty 
        : 'intermediate',
      hook: parsed.hook || '',
    };
  } catch (error) {
    console.error('AI summarization failed:', error);
    return getDefaultSummary(title, url);
  }
}

function getDefaultSummary(title: string, url: string): ArticleSummary {
  const hostname = new URL(url).hostname.replace('www.', '');
  
  let tags: string[] = [];
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('github.com')) tags.push('github');
  if (urlLower.includes('medium.com')) tags.push('blog');
  if (urlLower.includes('dev.to')) tags.push('blog');
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) tags.push('video');
  if (urlLower.includes('linkedin.com')) tags.push('linkedin');
  
  return {
    summary: title || `Article from ${hostname}`,
    tags,
    difficulty: 'intermediate',
    hook: '',
  };
}

export async function batchSummarize(
  articles: Array<{ title: string; content: string; url: string }>
): Promise<ArticleSummary[]> {
  const results: ArticleSummary[] = [];
  
  for (const article of articles) {
    const summary = await summarizeArticle(article.title, article.content, article.url);
    results.push(summary);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}
