import { Command } from 'commander';
import chalk from 'chalk';
import express, { Response } from 'express';
import path from 'path';
import fs from 'fs';
import open from 'open';
import { loadConfig } from '../config.js';
import { markAsRead, markAsUnread, getArticleById, getAllArticles } from '../db.js';
import { syncSlackSources } from '../slack/sync.js';
import { processArticles } from '../process.js';
import { generateMagazine } from '../magazine.js';
import type { Article } from '../types.js';

const sseClients: Set<Response> = new Set();

function broadcastArticle(article: Article): void {
  const data = JSON.stringify({ type: 'new-article', article });
  sseClients.forEach(client => {
    client.write(`data: ${data}\n\n`);
  });
}

export const serveCommand = new Command('serve')
  .description('Start local server to view magazine')
  .option('-p, --port <number>', 'Port number', '3000')
  .option('-w, --watch', 'Watch for new articles from Slack')
  .option('--interval <seconds>', 'Polling interval in seconds', '30')
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

    app.get('/api/events', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
    });

    app.get('/api/articles', (_req, res) => {
      const articles = getAllArticles(200);
      res.json(articles);
    });

    app.get('*', (_req, res) => {
      res.sendFile(indexPath);
    });

    app.listen(port, () => {
      const url = `http://localhost:${port}`;
      
      console.log(chalk.bold('\n🌐 LinkPress Server Running\n'));
      console.log(chalk.dim('   Local:   ') + chalk.cyan(url));
      console.log(chalk.dim('   Output:  ') + chalk.dim(outputDir));
      
      if (options.watch) {
        const interval = parseInt(options.interval, 10) * 1000;
        console.log(chalk.dim('   Watch:   ') + chalk.green('enabled') + chalk.dim(` (every ${options.interval}s)`));
        startWatching(interval, outputDir);
      }
      
      console.log(chalk.dim('\n   Press Ctrl+C to stop.\n'));

      if (options.open !== false) {
        open(url);
      }
    });
  });

async function startWatching(interval: number, _outputDir: string): Promise<void> {
  const config = loadConfig();
  
  async function poll() {
    try {
      const beforeIds = new Set(getAllArticles(500).map(a => a.id));
      
      await syncSlackSources(config, { silent: true });
      
      const newArticles = await processArticles({ silent: true });
      
      if (newArticles.length > 0) {
        generateMagazine();
        
        for (const article of newArticles) {
          if (!beforeIds.has(article.id)) {
            broadcastArticle(article);
            console.log(chalk.green(`   ✓ New: `) + chalk.dim(article.title || article.url));
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && !error.message.includes('No Slack sources')) {
        console.error(chalk.red('   Watch error:'), error.message);
      }
    }
  }

  setInterval(poll, interval);
  poll();
}
