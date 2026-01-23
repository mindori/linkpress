import chalk from 'chalk';
import ora from 'ora';
import crypto from 'crypto';
import { SlackClient, extractLinksFromMessages } from '@linkpress/core';
import { loadConfig } from '../config.js';
import { insertArticle, getExistingUrls } from '../db.js';
import { classifyContent } from '../ai.js';
import { t } from '../i18n.js';
import type { Article, ExtractedLink } from '../types.js';

const AI_BATCH_SIZE = 5;

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
        const uniqueLinks = extractLinksFromMessages(messages);

        totalUrls += uniqueLinks.length;

        const allUrls = uniqueLinks.map(l => l.url);
        const existingUrls = getExistingUrls(allUrls);

        const newLinks = uniqueLinks.filter(l => !existingUrls.has(l.url));
        const channelSkipped = uniqueLinks.length - newLinks.length;
        skipped += channelSkipped;

        let channelNew = 0;
        let channelFiltered = 0;

        for (let i = 0; i < newLinks.length; i += AI_BATCH_SIZE) {
          const batch = newLinks.slice(i, i + AI_BATCH_SIZE);
          
          if (spinner) {
            spinner.text = t('sync.classifying', {
              channel: channel.name,
              current: Math.min(i + AI_BATCH_SIZE, newLinks.length),
              total: newLinks.length
            });
          }

          const classificationResults = await Promise.all(
            batch.map(async (link): Promise<{ link: ExtractedLink; shouldCollect: boolean; reasoning: string }> => {
              try {
                const classification = await classifyContent(
                  link.messageText,
                  link.url,
                  '',
                  ''
                );
                return { link, shouldCollect: classification.shouldCollect, reasoning: classification.reasoning };
              } catch {
                return { link, shouldCollect: false, reasoning: 'Classification failed' };
              }
            })
          );

          for (const result of classificationResults) {
            if (!result.shouldCollect) {
              channelFiltered++;
              filtered++;
              if (!silent) {
                console.log(chalk.dim(`     ✗ ${result.link.url}`));
                console.log(chalk.dim(`       → ${result.reasoning}`));
              }
              continue;
            }

            const article: Article = {
              id: crypto.randomUUID(),
              url: result.link.url,
              title: result.link.url,
              tags: [],
              sourceType: 'slack',
              sourceId: channel.id,
              createdAt: result.link.timestamp,
            };

            insertArticle(article);
            channelNew++;
            newArticles++;
          }
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
