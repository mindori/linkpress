#!/usr/bin/env node

import { program } from 'commander';

program
  .name('linkpress')
  .description('Turn your Slack links into a personal tech magazine')
  .version('0.1.0');

program.parse();
