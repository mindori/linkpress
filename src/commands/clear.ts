import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { clearAllArticles } from '../db.js';
import { t } from '../i18n.js';

export const clearCommand = new Command('clear')
  .description('Clear all articles from the database')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options) => {
    if (!options.yes) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: t('clear.confirm'),
        default: false,
      }]);

      if (!confirm) {
        console.log(chalk.dim(t('clear.cancelled')));
        return;
      }
    }

    const count = clearAllArticles();
    console.log(chalk.green(`\n✅ ${t('clear.success', { count })}\n`));
  });
