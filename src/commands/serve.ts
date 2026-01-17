import { Command } from 'commander';
import chalk from 'chalk';

export const serveCommand = new Command('serve')
  .description('Start local server to view magazine')
  .option('-p, --port <number>', 'Port number', '3000')
  .action((options) => {
    console.log(chalk.bold('\n🌐 Local Server\n'));
    console.log(chalk.dim('Serve feature will be implemented after magazine generation.'));
    console.log(chalk.dim(`Planned port: ${options.port}`));
  });
