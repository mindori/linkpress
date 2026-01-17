import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

export const generateCommand = new Command('generate')
  .description('Generate magazine from collected articles')
  .action(async () => {
    const spinner = ora('Generating magazine...').start();
    
    spinner.info(chalk.dim('Generate feature will be implemented after scraping + AI summary.'));
    console.log(chalk.dim('Current articles can be viewed with: linkpress list'));
  });
