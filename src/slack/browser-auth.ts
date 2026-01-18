import { chromium, type Page, type BrowserContext } from 'playwright';
import chalk from 'chalk';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

export interface SlackTokens {
  token: string;
  cookie: string;
}

const DEBUG = process.env.LINKPRESS_DEBUG === '1';

function debug(msg: string, data?: unknown): void {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(chalk.gray(`[${timestamp}] ${msg}`));
  if (data !== undefined) {
    console.log(chalk.gray(JSON.stringify(data, null, 2)));
  }
}

function findChromeExecutable(): string | undefined {
  const possiblePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return undefined;
}

export async function extractSlackTokens(): Promise<SlackTokens | null> {
  console.log(chalk.cyan('\n🌐 Opening Slack in browser...'));
  console.log(chalk.dim('   Please log in to your workspace.'));
  console.log(chalk.dim('   The browser will close automatically after login.\n'));

  if (DEBUG) {
    console.log(chalk.yellow('   [DEBUG MODE ENABLED]\n'));
  }

  const chromePath = findChromeExecutable();

  if (chromePath) {
    console.log(chalk.dim(`   Using: ${chromePath}\n`));
  } else {
    console.log(chalk.yellow('   Warning: Could not find Chrome. Using Playwright Chromium.\n'));
  }

  const userDataDir = path.join(os.tmpdir(), 'linkpress-chrome-profile');
  debug('User data dir', userDataDir);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: chromePath,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    viewport: { width: 1280, height: 800 },
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    debug('Navigating to slack.com/signin');
    await page.goto('https://slack.com/signin', { 
      waitUntil: 'commit',
      timeout: 30000,
    }).catch((e) => debug('Navigation error (ignored)', e.message));

    console.log(chalk.dim('   Waiting for you to log in...'));
    console.log(chalk.dim('   (Press Ctrl+C to cancel)\n'));

    const result = await waitForTokens(context);

    await context.close();

    if (result) {
      console.log(chalk.green('✅ Tokens extracted successfully!'));
      debug('Extracted tokens', { token: result.token.substring(0, 20) + '...', cookie: result.cookie.substring(0, 20) + '...' });
      return result;
    }

    console.log(chalk.red('❌ Could not extract tokens. Please try manual method.'));
    return null;

  } catch (error) {
    debug('Error in extractSlackTokens', error instanceof Error ? error.message : error);
    await context.close();
    if (error instanceof Error && error.message.includes('Target closed')) {
      console.log(chalk.yellow('\n⚠️  Browser was closed. Please try again.'));
      return null;
    }
    throw error;
  }
}

async function extractTokensFromPage(page: Page, context: BrowserContext): Promise<SlackTokens | null> {
  try {
    debug('Extracting tokens from page...', page.url());

    const currentUrl = page.url();
    const extractionResult = await page.evaluate((url) => {
      const results: { 
        bootData: string | null;
        localConfig: string | null;
        redux: string | null;
        allLocalStorageKeys: string[];
        currentTeamId: string | null;
      } = {
        bootData: null,
        localConfig: null,
        redux: null,
        allLocalStorageKeys: Object.keys(localStorage),
        currentTeamId: null,
      };

      const teamMatch = url.match(/app\.slack\.com\/client\/([A-Z0-9]+)/);
      results.currentTeamId = teamMatch ? teamMatch[1] : null;

      const w = globalThis as unknown as { boot_data?: { api_token?: string; team_id?: string } };
      try {
        if (w.boot_data?.api_token) {
          if (!results.currentTeamId || w.boot_data.team_id === results.currentTeamId) {
            results.bootData = w.boot_data.api_token;
          }
        }
      } catch {}

      try {
        const localConfig = localStorage.getItem('localConfig_v2');
        if (localConfig) {
          const parsed = JSON.parse(localConfig);
          const teams = parsed?.teams;
          if (teams) {
            if (results.currentTeamId && teams[results.currentTeamId]?.token?.startsWith('xoxc-')) {
              results.localConfig = teams[results.currentTeamId].token;
            } else {
              const teamIds = Object.keys(teams);
              for (const teamId of teamIds) {
                const teamToken = teams[teamId]?.token;
                if (teamToken && teamToken.startsWith('xoxc-')) {
                  results.localConfig = teamToken;
                  break;
                }
              }
            }
          }
        }
      } catch {}

      try {
        const redux = localStorage.getItem('reduxPersist:teams');
        if (redux) {
          const parsed = JSON.parse(redux);
          if (results.currentTeamId && parsed[results.currentTeamId]?.token?.startsWith('xoxc-')) {
            results.redux = parsed[results.currentTeamId].token;
          } else {
            for (const team of Object.values(parsed) as Array<{ token?: string }>) {
              if (team?.token?.startsWith('xoxc-')) {
                results.redux = team.token;
                break;
              }
            }
          }
        }
      } catch {}

      return results;
    }, currentUrl);

    debug('Extraction results', {
      bootData: extractionResult.bootData ? extractionResult.bootData.substring(0, 20) + '...' : null,
      localConfig: extractionResult.localConfig ? extractionResult.localConfig.substring(0, 20) + '...' : null,
      redux: extractionResult.redux ? extractionResult.redux.substring(0, 20) + '...' : null,
      localStorageKeys: extractionResult.allLocalStorageKeys,
    });

    const token = extractionResult.bootData || extractionResult.localConfig || extractionResult.redux;

    if (!token) {
      debug('No token found in any source');
      return null;
    }

    const cookies = await context.cookies();
    debug('Cookies with d=', cookies.filter(c => c.name === 'd').map(c => ({ domain: c.domain, valuePreview: c.value.substring(0, 20) + '...' })));
    
    const dCookie = cookies.find(c => c.name === 'd' && c.value.startsWith('xoxd-'));

    if (!dCookie) {
      debug('No d cookie found with xoxd- prefix');
      return null;
    }

    debug('Found token and cookie!');
    return { token, cookie: dCookie.value };
  } catch (e) {
    debug('Error in extractTokensFromPage', e instanceof Error ? e.message : e);
    return null;
  }
}

function findSlackAppPage(context: BrowserContext): Page | null {
  const pages = context.pages();
  debug('Total pages', pages.length);
  
  for (const p of pages) {
    const url = p.url();
    debug('Checking page URL', url);
    if (url.includes('app.slack.com/client/')) {
      debug('Found Slack app page!');
      return p;
    }
  }
  return null;
}

async function waitForTokens(context: BrowserContext): Promise<SlackTokens | null> {
  const maxWaitTime = 5 * 60 * 1000;
  const checkInterval = 2000;
  const startTime = Date.now();
  let iteration = 0;
  let detectedLogin = false;

  while (Date.now() - startTime < maxWaitTime) {
    iteration++;
    try {
      const slackPage = findSlackAppPage(context);
      
      if (slackPage) {
        if (!detectedLogin) {
          console.log(chalk.dim('   Detected Slack workspace, extracting tokens...'));
          detectedLogin = true;
        }
        
        debug(`[Iteration ${iteration}] Found Slack app page, waiting for load...`);
        await slackPage.waitForTimeout(3000);
        
        const tokens = await extractTokensFromPage(slackPage, context);
        if (tokens) {
          return tokens;
        }

        debug('First extraction failed, reloading page...');
        await slackPage.reload().catch((e) => debug('Reload failed:', e instanceof Error ? e.message : String(e)));
        await slackPage.waitForTimeout(3000);
        
        const tokensAfterReload = await extractTokensFromPage(slackPage, context);
        if (tokensAfterReload) {
          return tokensAfterReload;
        }
        
        debug('Second extraction also failed, will retry...');
      } else {
        debug(`[Iteration ${iteration}] No Slack app page found yet`);
      }
    } catch (e) {
      debug('Error in waitForTokens loop', e instanceof Error ? e.message : e);
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  debug('Timeout reached, no tokens found');
  return null;
}
