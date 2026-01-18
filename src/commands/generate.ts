import { Command } from 'commander';
import chalk from 'chalk';
import { processArticles } from '../process.js';
import { getAllArticles } from '../db.js';
import { generateMagazine } from '../magazine.js';
import { t } from '../i18n.js';

export const generateCommand = new Command('generate')
  .description('Process articles and generate magazine')
  .option('-n, --limit <number>', 'Limit number of articles to process')
  .option('--skip-process', 'Skip processing, just generate HTML')
  .option('--reprocess', 'Reprocess already processed articles (regenerate AI summaries)')
  .action(async (options) => {
    if (!options.skipProcess) {
      const limit = options.limit ? parseInt(options.limit, 10) : undefined;
      const processedList = await processArticles({ limit, reprocess: options.reprocess });

      console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(chalk.bold(`📊 ${t('generate.processingSummary')}`));
      console.log(chalk.green(`   ${t('generate.processed', { count: processedList.length })}`));
      console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    }

    const articles = getAllArticles(1000);
    const processed = articles.filter(a => a.processedAt);
    const unprocessed = articles.filter(a => !a.processedAt);

    console.log(chalk.bold(`📚 ${t('generate.articleStats')}`));
    console.log(chalk.dim(`   ${t('generate.total', { count: articles.length })}`));
    console.log(chalk.green(`   ${t('generate.ready', { count: processed.length })}`));
    console.log(chalk.yellow(`   ${t('generate.pending', { count: unprocessed.length })}`));

    if (processed.length > 0) {
      const outputPath = generateMagazine({ limit: 500 });
      console.log(chalk.bold(`\n📰 ${t('generate.magazineGenerated')}`));
      console.log(chalk.cyan(`   ${outputPath}`));
      console.log(chalk.dim(`\n${t('generate.serveHint')}`));
    } else {
      console.log(chalk.yellow(`\n${t('generate.noArticles')}`));
    }
  });
