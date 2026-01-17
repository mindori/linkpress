import { Command } from 'commander';
import chalk from 'chalk';
import express from 'express';
import path from 'path';
import fs from 'fs';
import open from 'open';
import { loadConfig } from '../config.js';

export const serveCommand = new Command('serve')
  .description('Start local server to view magazine')
  .option('-p, --port <number>', 'Port number', '3000')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (options) => {
    const config = loadConfig();
    const outputDir = config.output.directory;
    const indexPath = path.join(outputDir, 'index.html');

    if (!fs.existsSync(indexPath)) {
      console.log(chalk.red('\n❌ No magazine found.'));
      console.log(chalk.dim('Run "linkpress generate" first to create your magazine.\n'));
      return;
    }

    const app = express();
    const port = parseInt(options.port, 10);

    app.use(express.static(outputDir));

    app.get('*', (_req, res) => {
      res.sendFile(indexPath);
    });

    const server = app.listen(port, () => {
      const url = `http://localhost:${port}`;
      
      console.log(chalk.bold('\n🌐 LinkPress Server Running\n'));
      console.log(chalk.dim('   Local:   ') + chalk.cyan(url));
      console.log(chalk.dim('   Output:  ') + chalk.dim(outputDir));
      console.log(chalk.dim('\n   Press Ctrl+C to stop.\n'));

      if (options.open !== false) {
        open(url);
      }
    });

    process.on('SIGINT', () => {
      console.log(chalk.dim('\n\n   Server stopped.\n'));
      server.close();
      process.exit(0);
    });
  });
