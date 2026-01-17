import { Command } from 'commander';
import chalk from 'chalk';
import { addSlackSource, listSlackSources, removeSlackSource, addChannelToSource, removeChannelFromSource } from '../slack/index.js';

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
  .command('remove <type>')
  .description('Remove a source (slack)')
  .action(async (type: string) => {
    if (type === 'slack') {
      await removeSlackSource();
    } else {
      console.log(chalk.red(`Unknown source type: ${type}`));
      console.log(chalk.dim('Available sources: slack'));
    }
  });

sourceCommand
  .command('add-channel')
  .description('Add a channel to an existing Slack workspace')
  .action(async () => {
    await addChannelToSource();
  });

sourceCommand
  .command('remove-channel')
  .description('Remove a channel from a workspace')
  .action(async () => {
    await removeChannelFromSource();
  });

sourceCommand
  .command('list')
  .description('List configured sources')
  .action(async () => {
    await listSlackSources();
  });
