import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import crypto from 'crypto';
import { insertArticle, articleExists } from '../db.js';
import type { Article } from '../types.js';

export const addCommand = new Command('add')
  .description('Add a URL to your reading list')
  .argument('<url>', 'URL to add')
  .action(async (url: string) => {
    const spinner = ora('Adding URL...').start();
    
    try {
      if (!isValidUrl(url)) {
        spinner.fail(chalk.red('Invalid URL format'));
        return;
      }
      
      if (articleExists(url)) {
        spinner.warn(chalk.yellow('URL already exists in your list'));
        return;
      }
      
      const article: Article = {
        id: crypto.randomUUID(),
        url,
        title: url,
        tags: [],
        sourceType: 'manual',
        createdAt: new Date(),
      };
      
      insertArticle(article);
      spinner.succeed(chalk.green('Added: ') + chalk.cyan(url));
      console.log(chalk.dim('Run "linkpress sync" to fetch article details'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to add URL'));
      console.error(error);
    }
  });

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}
