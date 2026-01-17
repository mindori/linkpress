import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { loadConfig, saveConfig, getConfigDir } from '../config.js';

export const initCommand = new Command('init')
  .description('Initialize LinkPress configuration')
  .action(async () => {
    console.log(chalk.bold('\n🚀 Welcome to LinkPress!\n'));
    
    const config = loadConfig();
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'aiApiKey',
        message: 'Enter your Anthropic API key (optional, press Enter to skip):',
        default: config.ai.apiKey || '',
      },
      {
        type: 'list',
        name: 'outputFormat',
        message: 'Select output format:',
        choices: ['html', 'markdown', 'both'],
        default: config.output.format,
      },
    ]);
    
    if (answers.aiApiKey) {
      config.ai.apiKey = answers.aiApiKey;
    }
    config.output.format = answers.outputFormat;
    
    saveConfig(config);
    
    console.log(chalk.green('\n✅ Configuration saved to'), chalk.cyan(getConfigDir()));
    console.log(chalk.dim('\nNext steps:'));
    console.log(chalk.dim('  1. Add a Slack source:'), chalk.white('linkpress source add slack'));
    console.log(chalk.dim('  2. Or add URLs manually:'), chalk.white('linkpress add <url>'));
    console.log(chalk.dim('  3. Generate magazine:'), chalk.white('linkpress generate'));
  });
