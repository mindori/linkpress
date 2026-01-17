import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

export const syncCommand = new Command('sync')
  .description('Sync articles from configured sources')
  .action(async () => {
    const spinner = ora('Syncing articles...').start();
    
    spinner.info(chalk.dim('Sync feature will be implemented with Slack integration.'));
    console.log(chalk.dim('For now, add articles manually with: linkpress add <url>'));
  });
