#!/usr/bin/env node

import { program } from 'commander';
import {
  addCommand,
  clearCommand,
  generateCommand,
  initCommand,
  listCommand,
  serveCommand,
  sourceCommand,
  syncCommand,
} from './commands/index.js';

process.on('uncaughtException', (error) => {
  if (error.name === 'ExitPromptError') {
    console.log('\n');
    process.exit(0);
  }
  throw error;
});

program
  .name('linkpress')
  .description('Turn your Slack links into a personal tech magazine')
  .version('0.2.3');

program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(listCommand);
program.addCommand(sourceCommand);
program.addCommand(syncCommand);
program.addCommand(generateCommand);
program.addCommand(serveCommand);
program.addCommand(clearCommand);

program.parse();
