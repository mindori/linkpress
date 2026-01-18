import { Command } from 'commander';
import chalk from 'chalk';
import { getAllArticles } from '../db.js';
import { truncate } from '../utils.js';

export const listCommand = new Command('list')
  .description('List all saved articles')
  .option('-n, --limit <number>', 'Number of articles to show', '20')
  .action((options) => {
    const limit = parseInt(options.limit, 10);
    const articles = getAllArticles(limit);
    
    if (articles.length === 0) {
      console.log(chalk.yellow('\nNo articles yet.'));
      console.log(chalk.dim('Add some with: linkpress add <url>'));
      return;
    }
    
    console.log(chalk.bold(`\n📚 Your Articles (${articles.length})\n`));
    
    articles.forEach((article, index) => {
      const status = article.processedAt 
        ? chalk.green('✓') 
        : chalk.yellow('○');
      
      const title = article.title || article.url;
      const truncatedTitle = truncate(title, 60);
      
      console.log(`${status} ${chalk.white(index + 1 + '.')} ${truncatedTitle}`);
      
      if (article.summary) {
        console.log(chalk.dim(`   ${article.summary.substring(0, 80)}...`));
      }
      
      if (article.tags.length > 0) {
        console.log(chalk.cyan(`   ${article.tags.map(t => `#${t}`).join(' ')}`));
      }
      
      console.log();
    });
  });
