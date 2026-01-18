import chalk from 'chalk';
import ora from 'ora';
import { getUnprocessedArticles, getArticlesForReprocess, updateArticle } from './db.js';
import { scrapeUrl, estimateReadingTime } from './scraper.js';
import { summarizeArticle, serializeSummary } from './ai.js';
import { loadConfig } from './config.js';
import type { Article } from './types.js';

export interface ProcessResult {
  processed: number;
  failed: number;
  skipped: number;
}

export interface ProcessOptions {
  limit?: number;
  reprocess?: boolean;
}

export async function processArticles(options: ProcessOptions = {}): Promise<ProcessResult> {
  const { limit, reprocess = false } = options;
  
  const articles = reprocess 
    ? getArticlesForReprocess(limit || 100)
    : getUnprocessedArticles();
  const toProcess = limit ? articles.slice(0, limit) : articles;
  
  if (toProcess.length === 0) {
    console.log(chalk.yellow(reprocess 
      ? '\nNo articles found to reprocess.' 
      : '\nNo unprocessed articles found.'));
    return { processed: 0, failed: 0, skipped: 0 };
  }

  const config = loadConfig();
  const hasAiKey = !!config.ai.apiKey;

  if (!hasAiKey) {
    console.log(chalk.yellow('\n⚠️  No AI API key configured. Summaries will be basic.'));
    console.log(chalk.dim('Run "linkpress init" to add your Anthropic API key.\n'));
  }

  console.log(chalk.bold(`\n📰 ${reprocess ? 'Reprocessing' : 'Processing'} ${toProcess.length} articles...\n`));

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const article = toProcess[i];
    const spinner = ora(`[${i + 1}/${toProcess.length}] ${truncate(article.url, 50)}`).start();

    try {
      if (shouldSkip(article.url)) {
        spinner.warn(chalk.dim('Skipped (unsupported URL type)'));
        skipped++;
        continue;
      }

      const scraped = await scrapeUrl(article.url);
      
      const summaryData = await summarizeArticle(
        scraped.title || article.title,
        scraped.content,
        article.url
      );

      const updatedArticle: Article = {
        ...article,
        title: summaryData.headline || scraped.title || article.url,
        description: scraped.description,
        content: scraped.content.substring(0, 5000),
        summary: serializeSummary(summaryData),
        tags: summaryData.tags,
        difficulty: summaryData.difficulty,
        readingTimeMinutes: estimateReadingTime(scraped.content),
        image: scraped.image,
        sourceLabel: scraped.sourceLabel,
        processedAt: new Date(),
      };

      updateArticle(updatedArticle);
      spinner.succeed(chalk.green(truncate(summaryData.headline || scraped.title || article.url, 60)));
      processed++;

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      spinner.fail(chalk.red(`Failed: ${errorMsg}`));
      failed++;
    }
  }

  return { processed, failed, skipped };
}

function shouldSkip(url: string): boolean {
  const skipPatterns = [
    /\.(pdf|zip|tar|gz|exe|dmg)$/i,
    /^mailto:/i,
    /^tel:/i,
    /^javascript:/i,
  ];
  
  return skipPatterns.some(pattern => pattern.test(url));
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
