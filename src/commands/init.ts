import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, saveConfig, getConfigDir } from '../config.js';
import { fetchModels, FALLBACK_MODELS, type ModelInfo } from '../ai.js';
import type { AIProvider } from '../types.js';

const PROVIDER_CHOICES = [
  { name: 'Anthropic (Claude)', value: 'anthropic' },
  { name: 'OpenAI (GPT)', value: 'openai' },
  { name: 'Google (Gemini)', value: 'gemini' },
];

export const initCommand = new Command('init')
  .description('Initialize LinkPress configuration')
  .action(async () => {
    console.log(chalk.bold('\n🚀 Welcome to LinkPress!\n'));
    
    const config = loadConfig();
    
    const { provider } = await inquirer.prompt([{
      type: 'list',
      name: 'provider',
      message: 'Select your AI provider:',
      choices: PROVIDER_CHOICES,
    }]);

    const providerName = PROVIDER_CHOICES.find(c => c.value === provider)?.name || provider;
    
    const { apiKey } = await inquirer.prompt([{
      type: 'password',
      name: 'apiKey',
      message: `Enter your ${providerName} API key:`,
      validate: (input: string) => {
        if (!input.trim()) {
          return 'API key is required.';
        }
        return true;
      },
    }]);

    const spinner = ora('Fetching available models...').start();
    let models = await fetchModels(provider as AIProvider, apiKey);
    
    if (models.length === 0) {
      spinner.warn('Could not fetch models. Using fallback list.');
      models = FALLBACK_MODELS[provider as AIProvider];
    } else {
      spinner.succeed(`Found ${models.length} models`);
    }

    const modelChoices = [
      ...models.map((m: ModelInfo) => ({
        name: m.name === m.id ? m.id : `${m.name} (${m.id})`,
        value: m.id,
      })),
      new inquirer.Separator(),
      { name: '[ Enter model ID manually ]', value: '__manual__' },
    ];

    const { model: selectedModel } = await inquirer.prompt([{
      type: 'list',
      name: 'model',
      message: 'Select model:',
      choices: modelChoices,
      pageSize: 15,
    }]);

    let finalModel = selectedModel;
    
    if (selectedModel === '__manual__') {
      const { manualModel } = await inquirer.prompt([{
        type: 'input',
        name: 'manualModel',
        message: 'Enter model ID:',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Model ID is required.';
          }
          return true;
        },
      }]);
      finalModel = manualModel;
    }

    config.ai.provider = provider as AIProvider;
    config.ai.model = finalModel;
    config.ai.apiKey = apiKey;

    const { outputFormat } = await inquirer.prompt([{
      type: 'list',
      name: 'outputFormat',
      message: 'Select output format:',
      choices: ['html', 'markdown', 'both'],
      default: config.output.format,
    }]);
    
    config.output.format = outputFormat;
    
    saveConfig(config);
    
    console.log(chalk.green('\n✅ Configuration saved to'), chalk.cyan(getConfigDir()));
    console.log(chalk.dim(`   Provider: ${providerName}`));
    console.log(chalk.dim(`   Model: ${finalModel}`));
    
    console.log(chalk.dim('\nNext steps:'));
    console.log(chalk.dim('  1. Add a Slack source:'), chalk.white('linkpress source add slack'));
    console.log(chalk.dim('  2. Or add URLs manually:'), chalk.white('linkpress add <url>'));
    console.log(chalk.dim('  3. Generate magazine:'), chalk.white('linkpress generate'));
  });
