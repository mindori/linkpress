import chalk from 'chalk';
import ora from 'ora';
import crypto from 'crypto';
import { SlackClient, extractLinksFromMessages } from '@linkpress/core';
import { loadConfig } from '../config.js';
import { insertArticle, articleExists } from '../db.js';
import { classifyContent } from '../ai.js';
import { t } from '../i18n.js';
import type { Article } from '../types.js';

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
