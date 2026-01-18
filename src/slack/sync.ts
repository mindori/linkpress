import chalk from 'chalk';
import ora from 'ora';
import crypto from 'crypto';
import { SlackClient } from './client.js';
import { loadConfig } from '../config.js';
import { insertArticle, articleExists } from '../db.js';
import { classifyContent } from '../ai.js';
import { t } from '../i18n.js';
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

interface ExtractedLink {
  url: string;
  messageText: string;
}

export interface SyncResult {
  total: number;
  newArticles: number;
  skipped: number;
  filtered: number;
}

export interface SyncOptions {
  silent?: boolean;
}

export async function syncSlackSources(config?: ReturnType<typeof loadConfig>, options: SyncOptions = {}): Promise<SyncResult> {
  const cfg = config || loadConfig();
  const { silent = false } = options;
  const sources = cfg.sources.slack || [];

  if (sources.length === 0) {
    if (!silent) {
      console.log(chalk.yellow(`\n${t('sync.noSources')}`));
      console.log(chalk.dim(t('sync.noSourcesHint')));
    }
    return { total: 0, newArticles: 0, skipped: 0, filtered: 0 };
  }

  let totalUrls = 0;
  let newArticles = 0;
  let skipped = 0;
  let filtered = 0;

  for (const source of sources) {
    if (!silent) {
      console.log(chalk.bold(`\n📡 ${t('sync.syncing', { workspace: source.workspace })}`));
    }

    const client = new SlackClient({ token: source.token, cookie: source.cookie });

    for (const channel of source.channels) {
      const spinner = silent ? null : ora(t('sync.fetching', { channel: channel.name })).start();

      try {
        const messages = await client.getConversationHistory(channel.id, { limit: 200 });
        const extractedLinks: ExtractedLink[] = [];

        for (const message of messages) {
          if (message.text) {
            const urls = extractUrls(message.text);
            for (const url of urls.filter(isArticleUrl)) {
              extractedLinks.push({ url, messageText: message.text });
            }
          }
        }

        const uniqueLinks = extractedLinks.reduce((acc, link) => {
          if (!acc.some(l => l.url === link.url)) {
            acc.push(link);
          }
          return acc;
        }, [] as ExtractedLink[]);

        totalUrls += uniqueLinks.length;

        let channelNew = 0;
        let channelSkipped = 0;
        let channelFiltered = 0;

        let processed = 0;

        for (const link of uniqueLinks) {
          processed++;
          if (spinner) {
            spinner.text = t('sync.classifying', { 
              channel: channel.name, 
              current: processed, 
              total: uniqueLinks.length 
            });
          }
          if (articleExists(link.url)) {
            channelSkipped++;
            skipped++;
            continue;
          }

          const classification = await classifyContent(
            link.messageText,
            link.url,
            '',
            ''
          );

          if (!classification.shouldCollect) {
            channelFiltered++;
            filtered++;
            if (!silent) {
              console.log(chalk.dim(`     ✗ ${link.url}`));
              console.log(chalk.dim(`       → ${classification.reasoning}`));
            }
            continue;
          }

          const article: Article = {
            id: crypto.randomUUID(),
            url: link.url,
            title: link.url,
            tags: [],
            sourceType: 'slack',
            sourceId: channel.id,
            createdAt: new Date(),
          };

          insertArticle(article);
          channelNew++;
          newArticles++;
        }

        spinner?.succeed(
          t('sync.channelResult', {
            channel: channel.name,
            total: uniqueLinks.length,
            new: channelNew,
            existing: channelSkipped,
            filtered: channelFiltered,
          })
        );
      } catch (error) {
        spinner?.fail(t('sync.channelFailed', { channel: channel.name }));
        if (error instanceof Error && !silent) {
          console.log(chalk.dim(`  Error: ${error.message}`));
        }
      }
    }
  }

  return { total: totalUrls, newArticles, skipped, filtered };
}
