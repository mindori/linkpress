import { Command } from 'commander';
import chalk from 'chalk';

export const sourceCommand = new Command('source')
  .description('Manage article sources');

sourceCommand
  .command('add <type>')
  .description('Add a new source (slack)')
  .action(async (type: string) => {
    if (type === 'slack') {
      console.log(chalk.bold('\n🔗 Slack Source Setup\n'));
      console.log(chalk.dim('This feature will be implemented in the next step.'));
      console.log(chalk.dim('For now, use "linkpress add <url>" to add articles manually.'));
    } else {
      console.log(chalk.red(`Unknown source type: ${type}`));
      console.log(chalk.dim('Available sources: slack'));
    }
  });

sourceCommand
  .command('list')
  .description('List configured sources')
  .action(() => {
    console.log(chalk.bold('\n📡 Configured Sources\n'));
    console.log(chalk.dim('No sources configured yet.'));
    console.log(chalk.dim('Add one with: linkpress source add slack'));
  });
