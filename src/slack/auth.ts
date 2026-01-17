import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { SlackClient } from './client.js';
import { extractSlackTokens } from './browser-auth.js';
import { loadConfig, saveConfig } from '../config.js';
import type { SlackSource, SlackChannel } from '../types.js';

export async function addSlackSource(): Promise<void> {
  console.log(chalk.bold('\n🔗 Add Slack Workspace\n'));

  const { method } = await inquirer.prompt([{
    type: 'list',
    name: 'method',
    message: 'How would you like to authenticate?',
    choices: [
      { name: '🤖 Automatic (opens browser, extracts tokens after login)', value: 'auto' },
      { name: '📋 Manual (paste tokens from DevTools)', value: 'manual' },
    ],
  }]);

  let token: string;
  let cookie: string;

  if (method === 'auto') {
    const tokens = await extractSlackTokens();
    if (!tokens) {
      console.log(chalk.yellow('\nFalling back to manual method...\n'));
      const manualTokens = await promptManualTokens();
      token = manualTokens.token;
      cookie = manualTokens.cookie;
    } else {
      token = tokens.token;
      cookie = tokens.cookie;
    }
  } else {
    const manualTokens = await promptManualTokens();
    token = manualTokens.token;
    cookie = manualTokens.cookie;
  }

  await connectWithTokens(token, cookie);
}

async function promptManualTokens(): Promise<{ token: string; cookie: string }> {
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold('\n📋 How to get your Slack tokens:\n'));
  console.log('1. Open Slack in your browser (app.slack.com)');
  console.log('2. Open Developer Tools (F12 or Cmd+Option+I)');
  console.log('3. Go to the ' + chalk.cyan('Network') + ' tab');
  console.log('4. Type ' + chalk.cyan('api') + ' in the filter box');
  console.log('5. Click any request and find the ' + chalk.cyan('Request Headers'));
  console.log('');
  console.log(chalk.bold('   Token (xoxc-...):'));
  console.log('   - Look for ' + chalk.cyan('Authorization: Bearer xoxc-...'));
  console.log('   - Copy the value starting with ' + chalk.yellow('xoxc-'));
  console.log('');
  console.log(chalk.bold('   Cookie (xoxd-...):'));
  console.log('   - Look for ' + chalk.cyan('Cookie:') + ' header');
  console.log('   - Find ' + chalk.yellow('d=xoxd-...') + ' and copy the value after ' + chalk.cyan('d='));
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  const { token } = await inquirer.prompt([{
    type: 'password',
    name: 'token',
    message: 'Paste your token (xoxc-...):',
    validate: (input: string) => {
      if (!input.startsWith('xoxc-')) {
        return 'Token should start with xoxc-';
      }
      return true;
    },
  }]);

  const { cookie } = await inquirer.prompt([{
    type: 'password',
    name: 'cookie',
    message: 'Paste your cookie (xoxd-...):',
    validate: (input: string) => {
      if (!input.startsWith('xoxd-')) {
        return 'Cookie should start with xoxd-';
      }
      return true;
    },
  }]);

  return { token, cookie };
}

async function connectWithTokens(token: string, cookie: string): Promise<void> {
  const spinner = ora('Testing connection...').start();

  try {
    const client = new SlackClient({ token, cookie });
    const user = await client.testAuth();
    spinner.succeed(chalk.green(`Connected as ${user.name}`));

    spinner.start('Fetching channels...');
    const conversations = await client.getConversations();
    spinner.succeed(`Found ${conversations.length} conversations`);

    const choices = conversations
      .filter(c => !c.isIm || c.user === user.id)
      .map(c => {
        let label = c.name;
        if (c.isIm && c.user === user.id) {
          label = '📝 My Saved Messages (DM to self)';
        } else if (c.isPrivate) {
          label = `🔒 ${c.name}`;
        } else if (c.isMpim) {
          label = `👥 ${c.name}`;
        } else {
          label = `# ${c.name}`;
        }
        return {
          name: label,
          value: c.id,
          checked: c.isIm && c.user === user.id,
        };
      });

    const { selectedChannels } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedChannels',
      message: 'Select channels to watch (space to select):',
      choices,
      pageSize: 15,
      validate: (answer: string[]) => {
        if (answer.length === 0) {
          return 'Select at least one channel';
        }
        return true;
      },
    }]);

    const selectedConversations = conversations.filter(c =>
      selectedChannels.includes(c.id)
    );

    const channels: SlackChannel[] = await Promise.all(
      selectedConversations.map(async (c) => {
        let name = c.name;
        if (c.isIm) {
          if (c.user === user.id) {
            name = 'Saved Messages';
          } else if (c.user) {
            try {
              const userInfo = await client.getUserInfo(c.user);
              name = `DM: ${userInfo.realName}`;
            } catch {
              name = `DM: ${c.user}`;
            }
          }
        }
        return {
          id: c.id,
          name,
          isPrivate: c.isPrivate || c.isIm || c.isMpim,
          isSelfDM: c.isIm && c.user === user.id,
        };
      })
    );

    const config = loadConfig();
    if (!config.sources.slack) {
      config.sources.slack = [];
    }

    const source: SlackSource = {
      id: client.generateSourceId(),
      workspace: user.name,
      token,
      cookie,
      channels,
      addedAt: new Date(),
    };

    config.sources.slack.push(source);
    saveConfig(config);

    console.log(chalk.green('\n✅ Slack workspace added successfully!'));
    console.log(chalk.dim('\nWatching channels:'));
    channels.forEach(ch => {
      console.log(chalk.dim(`  • ${ch.name}`));
    });
    console.log(chalk.dim('\nRun "linkpress sync" to fetch links from Slack.'));

  } catch (error) {
    spinner.fail(chalk.red('Connection failed'));
    if (error instanceof Error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
    console.log(chalk.dim('\nMake sure your tokens are correct and not expired.'));
  }
}

export async function listSlackSources(): Promise<void> {
  const config = loadConfig();
  const sources = config.sources.slack || [];

  if (sources.length === 0) {
    console.log(chalk.yellow('\nNo Slack workspaces configured.'));
    console.log(chalk.dim('Add one with: linkpress source add slack'));
    return;
  }

  console.log(chalk.bold('\n📡 Slack Workspaces\n'));

  sources.forEach((source, index) => {
    console.log(chalk.white(`${index + 1}. ${source.workspace}`));
    console.log(chalk.dim(`   Added: ${new Date(source.addedAt).toLocaleDateString()}`));
    console.log(chalk.dim('   Channels:'));
    source.channels.forEach(ch => {
      console.log(chalk.dim(`     • ${ch.name}`));
    });
    console.log();
  });
}
