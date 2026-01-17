import { Command } from 'commander';
import chalk from 'chalk';
import { addSlackSource, listSlackSources } from '../slack/index.js';

export const sourceCommand = new Command('source')
  .description('Manage article sources');

sourceCommand
  .command('add <type>')
  .description('Add a new source (slack)')
  .action(async (type: string) => {
    if (type === 'slack') {
      await addSlackSource();
    } else {
      console.log(chalk.red(`Unknown source type: ${type}`));
      console.log(chalk.dim('Available sources: slack'));
    }
  });

sourceCommand
  .command('list')
  .description('List configured sources')
  .action(async () => {
    console.log(chalk.bold('\n📡 Configured Sources'));
    await listSlackSources();
  });
