import { Command } from 'commander';
import chalk from 'chalk';
import express from 'express';
import path from 'path';
import fs from 'fs';
import open from 'open';
import { loadConfig } from '../config.js';
import { markAsRead, markAsUnread, getArticleById } from '../db.js';

export const serveCommand = new Command('serve')
  .description('Start local server to view magazine')
  .option('-p, --port <number>', 'Port number', '3000')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (options) => {
    process.on('SIGINT', () => {
      console.log(chalk.dim('\n\n   Server stopped.\n'));
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      process.exit(0);
    });

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

    app.use(express.json());
    app.use(express.static(outputDir));

    app.post('/api/articles/:id/read', (req, res) => {
      const { id } = req.params;
      const article = getArticleById(id);
      if (!article) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }
      markAsRead(id);
      res.json({ success: true, readAt: new Date().toISOString() });
    });

    app.delete('/api/articles/:id/read', (req, res) => {
      const { id } = req.params;
      const article = getArticleById(id);
      if (!article) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }
      markAsUnread(id);
      res.json({ success: true, readAt: null });
    });

    app.get('*', (_req, res) => {
      res.sendFile(indexPath);
    });

    app.listen(port, () => {
      const url = `http://localhost:${port}`;
      
      console.log(chalk.bold('\n🌐 LinkPress Server Running\n'));
      console.log(chalk.dim('   Local:   ') + chalk.cyan(url));
      console.log(chalk.dim('   Output:  ') + chalk.dim(outputDir));
      console.log(chalk.dim('\n   Press Ctrl+C to stop.\n'));

      if (options.open !== false) {
        open(url);
      }
    });
  });
