import { Command } from 'commander';
import chalk from 'chalk';
import { syncSlackSources } from '../slack/index.js';
import { t } from '../i18n.js';

export const syncCommand = new Command('sync')
  .description('Sync articles from configured sources')
  .action(async () => {
    console.log(chalk.bold(`\n🔄 ${t('sync.start')}\n`));

    const result = await syncSlackSources();

    console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold(`📊 ${t('sync.summary')}`));
    console.log(chalk.dim(`   ${t('sync.totalLinks', { count: result.total })}`));
    console.log(chalk.green(`   ${t('sync.newArticles', { count: result.newArticles })}`));
    console.log(chalk.dim(`   ${t('sync.alreadySaved', { count: result.skipped })}`));
    console.log(chalk.yellow(`   ${t('sync.filteredOut', { count: result.filtered })}`));
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    if (result.newArticles > 0) {
      console.log(chalk.dim(t('sync.generateHint')));
    } else if (result.total === 0) {
      console.log(chalk.dim(t('sync.noLinksHint')));
    }
  });
