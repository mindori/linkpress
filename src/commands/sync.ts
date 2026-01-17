import { Command } from 'commander';
import chalk from 'chalk';
import { syncSlackSources } from '../slack/index.js';

export const syncCommand = new Command('sync')
  .description('Sync articles from configured sources')
  .action(async () => {
    console.log(chalk.bold('\n🔄 Syncing articles...\n'));

    const result = await syncSlackSources();

    console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold('📊 Sync Summary'));
    console.log(chalk.dim(`   Total links found: ${result.total}`));
    console.log(chalk.green(`   New articles: ${result.newArticles}`));
    console.log(chalk.dim(`   Already saved: ${result.skipped}`));
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    if (result.newArticles > 0) {
      console.log(chalk.dim('Run "linkpress generate" to create your magazine.'));
    } else if (result.total === 0) {
      console.log(chalk.dim('No links found. Try adding more channels or URLs manually.'));
    }
  });
