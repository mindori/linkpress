import chalk from 'chalk';
import ora from 'ora';
import crypto from 'crypto';
import { SlackClient } from './client.js';
import { loadConfig } from '../config.js';
import { insertArticle, articleExists } from '../db.js';
import type { Article } from '../types.js';

const URL_REGEX = /https?:\/\/[^\s<>|]+/g;
const SLACK_URL_REGEX = /<(https?:\/\/[^|>]+)(?:\|[^>]*)?>​/g;

const IGNORED_DOMAINS = [
  'slack.com',
  'slack-edge.com',
  'slack-imgs.com',
  'giphy.com',
  'tenor.com',
  'emoji.slack-edge.com',
];

function extractUrls(text: string): string[] {
  const urls = new Set<string>();

  const slackMatches = text.matchAll(/<(https?:\/\/[^|>]+)(?:\|[^>]*)?>/g);
  for (const match of slackMatches) {
    urls.add(match[1]);
  }

  const plainMatches = text.matchAll(URL_REGEX);
  for (const match of plainMatches) {
    let url = match[0];
    url = url.replace(/[.,;:!?)]+$/, '');
    urls.add(url);
  }

  return Array.from(urls).filter(url => {
    try {
      const parsed = new URL(url);
      return !IGNORED_DOMAINS.some(domain => parsed.hostname.includes(domain));
    } catch {
      return false;
    }
  });
}

function isArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    
    const nonArticlePatterns = [
      /\.(png|jpg|jpeg|gif|webp|svg|ico|pdf|zip|tar|gz)$/i,
      /^\/?(favicon|robots\.txt|sitemap)/i,
    ];
    
    for (const pattern of nonArticlePatterns) {
      if (pattern.test(path)) {
        return false;
      }
    }

    const articleDomains = [
      'medium.com',
      'dev.to',
      'hashnode.dev',
      'substack.com',
      'github.com',
      'twitter.com',
      'x.com',
      'linkedin.com',
      'youtube.com',
      'youtu.be',
      'notion.so',
      'notion.site',
      'velog.io',
      'tistory.com',
      'brunch.co.kr',
    ];

    if (articleDomains.some(d => parsed.hostname.includes(d))) {
      return true;
    }

    if (path.length > 10 || path.includes('/blog') || path.includes('/post') || path.includes('/article')) {
      return true;
    }

    return true;
  } catch {
    return false;
  }
}

export interface SyncResult {
  total: number;
  newArticles: number;
  skipped: number;
}

export async function syncSlackSources(): Promise<SyncResult> {
  const config = loadConfig();
  const sources = config.sources.slack || [];

  if (sources.length === 0) {
    console.log(chalk.yellow('\nNo Slack sources configured.'));
    console.log(chalk.dim('Add one with: linkpress source add slack'));
    return { total: 0, newArticles: 0, skipped: 0 };
  }

  let totalUrls = 0;
  let newArticles = 0;
  let skipped = 0;

  for (const source of sources) {
    console.log(chalk.bold(`\n📡 Syncing: ${source.workspace}`));

    const client = new SlackClient({ token: source.token, cookie: source.cookie });

    for (const channel of source.channels) {
      const spinner = ora(`Fetching from ${channel.name}...`).start();

      try {
        const messages = await client.getConversationHistory(channel.id, { limit: 200 });
        const allUrls: string[] = [];

        for (const message of messages) {
          if (message.text) {
            const urls = extractUrls(message.text);
            allUrls.push(...urls.filter(isArticleUrl));
          }
        }

        const uniqueUrls = [...new Set(allUrls)];
        totalUrls += uniqueUrls.length;

        let channelNew = 0;
        let channelSkipped = 0;

        for (const url of uniqueUrls) {
          if (articleExists(url)) {
            channelSkipped++;
            skipped++;
            continue;
          }

          const article: Article = {
            id: crypto.randomUUID(),
            url,
            title: url,
            tags: [],
            sourceType: 'slack',
            sourceId: channel.id,
            createdAt: new Date(),
          };

          insertArticle(article);
          channelNew++;
          newArticles++;
        }

        spinner.succeed(
          `${channel.name}: ${uniqueUrls.length} links found, ${channelNew} new, ${channelSkipped} already saved`
        );
      } catch (error) {
        spinner.fail(`${channel.name}: Failed to fetch`);
        if (error instanceof Error) {
          console.log(chalk.dim(`  Error: ${error.message}`));
        }
      }
    }
  }

  return { total: totalUrls, newArticles, skipped };
}
