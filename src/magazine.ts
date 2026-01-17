import fs from 'fs';
import path from 'path';
import { loadConfig, ensureConfigDir } from './config.js';
import { getAllArticles } from './db.js';
import { parseSummary } from './ai.js';
import type { Article } from './types.js';

export interface MagazineOptions {
  limit?: number;
  outputDir?: string;
}

export function generateMagazine(options: MagazineOptions = {}): string {
  const config = loadConfig();
  const articles = getAllArticles(options.limit || 100);
  const processedArticles = articles.filter(a => a.processedAt);
  
  const outputDir = options.outputDir || config.output.directory;
  ensureConfigDir();
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const html = renderMagazineHtml(processedArticles);
  const outputPath = path.join(outputDir, 'index.html');
  
  fs.writeFileSync(outputPath, html, 'utf-8');
  
  return outputPath;
}

function renderMagazineHtml(articles: Article[]): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const tagCounts = new Map<string, number>();
  articles.forEach(a => {
    a.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const articleCards = articles.map(article => renderArticleCard(article)).join('\n');
  const tagFilters = topTags.map(([tag, count]) => 
    `<button class="tag-filter" data-tag="${tag}">${tag} (${count})</button>`
  ).join('\n');

  const totalReadingTime = articles.reduce((sum, a) => sum + (a.readingTimeMinutes || 0), 0);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LinkPress - Tech Briefing</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f10;
      min-height: 100vh;
      color: #e4e4e7;
      line-height: 1.7;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    header {
      text-align: center;
      padding: 4rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      margin-bottom: 3rem;
    }
    
    .logo {
      font-size: 3.5rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #f472b6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.5rem;
    }
    
    .edition {
      color: #71717a;
      font-size: 1rem;
      margin-bottom: 2rem;
    }
    
    .stats {
      display: flex;
      justify-content: center;
      gap: 3rem;
    }
    
    .stat {
      text-align: center;
    }
    
    .stat-value {
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, #818cf8, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .stat-label {
      font-size: 0.85rem;
      color: #52525b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 3rem;
      justify-content: center;
    }
    
    .tag-filter {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      color: #a1a1aa;
      padding: 0.6rem 1.2rem;
      border-radius: 2rem;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    }
    
    .tag-filter:hover, .tag-filter.active {
      background: rgba(129, 140, 248, 0.15);
      border-color: rgba(129, 140, 248, 0.4);
      color: #c4b5fd;
    }
    
    .articles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
      gap: 1.5rem;
    }
    
    .article-card {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 1rem;
      padding: 1.75rem;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
    }
    
    .article-card:hover {
      transform: translateY(-2px);
      border-color: rgba(129, 140, 248, 0.3);
      background: rgba(255,255,255,0.03);
    }
    
    .article-header {
      margin-bottom: 1rem;
    }
    
    .article-headline {
      font-size: 1.25rem;
      font-weight: 700;
      color: #f4f4f5;
      line-height: 1.4;
      margin-bottom: 0.5rem;
      text-decoration: none;
      display: block;
    }
    
    .article-headline:hover {
      color: #a5b4fc;
    }
    
    .article-tldr {
      color: #a1a1aa;
      font-size: 0.95rem;
      padding: 0.75rem 1rem;
      background: rgba(129, 140, 248, 0.05);
      border-left: 3px solid #818cf8;
      border-radius: 0 0.5rem 0.5rem 0;
      margin-bottom: 1rem;
    }
    
    .key-points {
      margin-bottom: 1rem;
    }
    
    .key-points-title {
      font-size: 0.75rem;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    
    .key-point {
      color: #d4d4d8;
      font-size: 0.9rem;
      padding: 0.4rem 0;
      padding-left: 1.25rem;
      position: relative;
    }
    
    .key-point::before {
      content: "→";
      position: absolute;
      left: 0;
      color: #818cf8;
    }
    
    .why-matters {
      background: rgba(251, 191, 36, 0.08);
      border: 1px solid rgba(251, 191, 36, 0.2);
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
    }
    
    .why-matters-label {
      font-size: 0.7rem;
      color: #fbbf24;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.25rem;
    }
    
    .why-matters-text {
      color: #fef3c7;
      font-size: 0.85rem;
    }
    
    .key-quote {
      font-style: italic;
      color: #a1a1aa;
      font-size: 0.9rem;
      padding: 0.75rem 1rem;
      border-left: 2px solid #52525b;
      margin-bottom: 1rem;
    }
    
    .key-quote::before {
      content: '"';
      color: #71717a;
    }
    
    .key-quote::after {
      content: '"';
      color: #71717a;
    }
    
    .article-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
      padding-top: 1rem;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    
    .article-source {
      font-size: 0.8rem;
      color: #52525b;
    }
    
    .article-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .article-time {
      font-size: 0.8rem;
      color: #71717a;
    }
    
    .difficulty {
      padding: 0.25rem 0.6rem;
      border-radius: 1rem;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    
    .difficulty-beginner { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
    .difficulty-intermediate { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
    .difficulty-advanced { background: rgba(239, 68, 68, 0.15); color: #f87171; }
    
    .article-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-top: 0.75rem;
    }
    
    .tag {
      background: rgba(129, 140, 248, 0.1);
      color: #a5b4fc;
      padding: 0.2rem 0.6rem;
      border-radius: 1rem;
      font-size: 0.7rem;
    }
    
    footer {
      text-align: center;
      padding: 4rem 0;
      margin-top: 4rem;
      border-top: 1px solid rgba(255,255,255,0.06);
      color: #52525b;
    }
    
    footer a {
      color: #818cf8;
      text-decoration: none;
    }
    
    @media (max-width: 768px) {
      .container { padding: 1rem; }
      .logo { font-size: 2.5rem; }
      .articles { grid-template-columns: 1fr; }
      .stats { gap: 1.5rem; }
      .stat-value { font-size: 2rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1 class="logo">LinkPress</h1>
      <p class="edition">${dateStr} Edition</p>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${articles.length}</div>
          <div class="stat-label">Articles</div>
        </div>
        <div class="stat">
          <div class="stat-value">${topTags.length}</div>
          <div class="stat-label">Topics</div>
        </div>
        <div class="stat">
          <div class="stat-value">${totalReadingTime}</div>
          <div class="stat-label">Min Read</div>
        </div>
      </div>
    </header>
    
    <div class="filters">
      <button class="tag-filter active" data-tag="all">All</button>
      ${tagFilters}
    </div>
    
    <div class="articles">
      ${articleCards}
    </div>
    
    <footer>
      <p>Generated by <a href="https://github.com/user/linkpress">LinkPress</a></p>
    </footer>
  </div>
  
  <script>
    document.querySelectorAll('.tag-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tag-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const tag = btn.dataset.tag;
        document.querySelectorAll('.article-card').forEach(card => {
          if (tag === 'all' || card.dataset.tags.includes(tag)) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  </script>
</body>
</html>`;
}

function renderArticleCard(article: Article): string {
  const summary = parseSummary(article.summary);
  
  const hostname = (() => {
    try {
      return new URL(article.url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  })();

  const headline = summary?.headline || article.title;
  const tldr = summary?.tldr || article.description || '';
  const keyPoints = summary?.keyPoints || [];
  const whyItMatters = summary?.whyItMatters || '';
  const keyQuote = summary?.keyQuote || '';
  const difficulty = article.difficulty || 'intermediate';

  const difficultyClass = `difficulty-${difficulty}`;
  const difficultyLabel = { beginner: '입문', intermediate: '중급', advanced: '심화' }[difficulty];

  const keyPointsHtml = keyPoints.length > 0 ? `
    <div class="key-points">
      <div class="key-points-title">핵심 포인트</div>
      ${keyPoints.map(point => `<div class="key-point">${escapeHtml(point)}</div>`).join('')}
    </div>
  ` : '';

  const whyMattersHtml = whyItMatters ? `
    <div class="why-matters">
      <div class="why-matters-label">왜 중요한가</div>
      <div class="why-matters-text">${escapeHtml(whyItMatters)}</div>
    </div>
  ` : '';

  const keyQuoteHtml = keyQuote ? `
    <div class="key-quote">${escapeHtml(keyQuote)}</div>
  ` : '';

  return `
    <article class="article-card" data-tags="${article.tags.join(',')}">
      <div class="article-header">
        <a href="${article.url}" target="_blank" rel="noopener" class="article-headline">
          ${escapeHtml(headline)}
        </a>
      </div>
      
      ${tldr ? `<div class="article-tldr">${escapeHtml(tldr)}</div>` : ''}
      
      ${keyPointsHtml}
      ${whyMattersHtml}
      ${keyQuoteHtml}
      
      <div class="article-meta">
        <span class="article-source">${escapeHtml(hostname)}</span>
        <div class="article-info">
          <span class="article-time">${article.readingTimeMinutes || '?'}분</span>
          <span class="difficulty ${difficultyClass}">${difficultyLabel}</span>
        </div>
      </div>
      
      <div class="article-tags">
        ${article.tags.slice(0, 4).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
    </article>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
