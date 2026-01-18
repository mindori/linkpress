#!/usr/bin/env node

import { program } from 'commander';
import {
  initCommand,
  addCommand,
  listCommand,
  sourceCommand,
  syncCommand,
  generateCommand,
  serveCommand,
  clearCommand,
} from './commands/index.js';

program
  .name('linkpress')
  .description('Turn your Slack links into a personal tech magazine')
  .version('0.2.1');

program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(listCommand);
program.addCommand(sourceCommand);
program.addCommand(syncCommand);
program.addCommand(generateCommand);
program.addCommand(serveCommand);
program.addCommand(clearCommand);

program.parse();
