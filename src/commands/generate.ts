import { Command } from 'commander';
import chalk from 'chalk';
import { processArticles } from '../process.js';
import { getAllArticles } from '../db.js';

export const generateCommand = new Command('generate')
  .description('Process articles and generate magazine')
  .option('-n, --limit <number>', 'Limit number of articles to process')
  .option('--skip-process', 'Skip processing, just show stats')
  .action(async (options) => {
    if (!options.skipProcess) {
      const limit = options.limit ? parseInt(options.limit, 10) : undefined;
      const result = await processArticles(limit);

      console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(chalk.bold('📊 Processing Summary'));
      console.log(chalk.green(`   Processed: ${result.processed}`));
      console.log(chalk.red(`   Failed: ${result.failed}`));
      console.log(chalk.dim(`   Skipped: ${result.skipped}`));
      console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    }

    const articles = getAllArticles(1000);
    const processed = articles.filter(a => a.processedAt);
    const unprocessed = articles.filter(a => !a.processedAt);

    console.log(chalk.bold('📚 Article Stats'));
    console.log(chalk.dim(`   Total: ${articles.length}`));
    console.log(chalk.green(`   Ready: ${processed.length}`));
    console.log(chalk.yellow(`   Pending: ${unprocessed.length}`));

    if (processed.length > 0) {
      console.log(chalk.dim('\nRun "linkpress serve" to view your magazine.'));
    }
  });
