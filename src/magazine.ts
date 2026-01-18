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
  const dateStr = now.toLocaleDateString('en-US', {
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
    .slice(0, 8);

  const unreadArticles = articles.filter(a => !a.readAt);
  const readArticles = articles.filter(a => a.readAt);
  
  const featuredArticle = unreadArticles[0];
  const remainingUnread = unreadArticles.slice(1);

  const unreadReadingTime = unreadArticles.reduce((sum, a) => sum + (a.readingTimeMinutes || 0), 0);
  const issueStats: IssueStats = {
    totalArticles: unreadArticles.length,
    totalReadingTime: unreadReadingTime,
  };

  const featuredHtml = featuredArticle ? renderFeaturedCard(featuredArticle, issueStats) : '';
  const unreadCards = remainingUnread.map((article, idx) => renderArticleCard(article, idx)).join('\n');
  const readCards = readArticles.map((article, idx) => renderArticleCard(article, idx)).join('\n');
  const tagFilters = topTags.map(([tag]) =>
    `<button class="tag-btn" data-tag="${tag}">${tag}</button>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="ko" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LinkPress — Tech Feed</title>
  <link rel="preconnect" href="https://cdn.jsdelivr.net">
  <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" rel="stylesheet">
  <style>
    :root, [data-theme="dark"] {
      --bg-deep: #0a0a0b;
      --bg-surface: #111113;
      --bg-elevated: #18181b;
      --bg-inset: rgba(255, 255, 255, 0.03);
      --text-primary: #fafaf9;
      --text-secondary: #a8a29e;
      --text-muted: #57534e;
      --accent: #f97316;
      --accent-subtle: rgba(249, 115, 22, 0.12);
      --border: rgba(255, 255, 255, 0.06);
      --border-hover: rgba(255, 255, 255, 0.12);
      --card-shadow: rgba(0, 0, 0, 0.25);
      --card-shadow-hover: rgba(0, 0, 0, 0.6);
      --font-main: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'Pretendard', monospace;
    }

    [data-theme="light"] {
      --bg-deep: #f5f5f4;
      --bg-surface: #ffffff;
      --bg-elevated: #fafaf9;
      --bg-inset: #f0f0ef;
      --text-primary: #1a1a1a;
      --text-secondary: #525252;
      --text-muted: #a3a3a3;
      --accent: #ea580c;
      --accent-subtle: rgba(234, 88, 12, 0.1);
      --border: rgba(0, 0, 0, 0.1);
      --border-hover: rgba(0, 0, 0, 0.2);
      --card-shadow: rgba(0, 0, 0, 0.08);
      --card-shadow-hover: rgba(0, 0, 0, 0.15);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html {
      scroll-behavior: smooth;
    }

    body {
      font-family: var(--font-main);
      background: var(--bg-deep);
      color: var(--text-primary);
      min-height: 100vh;
      line-height: 1.7;
      overflow-x: hidden;
      transition: background 0.3s ease, color 0.3s ease;
    }

    [data-theme="dark"] body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0.03;
      pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
      z-index: 1000;
    }

    [data-theme="light"] body::before {
      display: none;
    }

    /* Masthead */
    .masthead {
      padding: 2rem 3rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      position: relative;
    }

    .masthead::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 3rem;
      width: 60px;
      height: 3px;
      background: var(--accent);
    }

    .brand {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .brand-name {
      font-family: var(--font-main);
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    .issue-title {
      font-family: var(--font-main);
      font-size: 2.5rem;
      font-weight: 300;
      letter-spacing: -0.03em;
      line-height: 1;
    }

    .masthead-right {
      display: flex;
      align-items: flex-end;
      gap: 1.5rem;
    }

    .theme-toggle {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      color: var(--text-secondary);
    }

    .theme-toggle:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .theme-toggle svg {
      width: 18px;
      height: 18px;
    }

    .theme-toggle .icon-sun,
    [data-theme="light"] .theme-toggle .icon-moon {
      display: none;
    }

    [data-theme="light"] .theme-toggle .icon-sun {
      display: block;
    }

    .theme-toggle .icon-moon {
      display: block;
    }

    .masthead-meta {
      text-align: right;
      font-family: var(--font-mono);
      font-size: 0.7rem;
      color: var(--text-muted);
      line-height: 1.8;
    }

    .masthead-meta strong {
      color: var(--text-secondary);
      font-weight: 500;
    }

    /* Hero Section */
    .hero {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 0;
      min-height: 70vh;
      border-bottom: 1px solid var(--border);
    }

    .hero-main {
      padding: 4rem 3rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-right: 1px solid var(--border);
      position: relative;
    }

    .hero-main::before {
      content: 'FEATURED';
      position: absolute;
      top: 4rem;
      left: 3rem;
      font-family: var(--font-mono);
      font-size: 0.65rem;
      font-weight: 500;
      letter-spacing: 0.15em;
      color: var(--accent);
      padding: 0.35rem 0.75rem;
      background: var(--accent-subtle);
      border: 1px solid rgba(249, 115, 22, 0.25);
    }

    .hero-content {
      margin-top: 5rem;
    }

    .hero-headline {
      font-family: var(--font-main);
      font-size: clamp(2.5rem, 5vw, 4rem);
      font-weight: 400;
      line-height: 1.1;
      letter-spacing: -0.02em;
      margin-bottom: 1.5rem;
      max-width: 90%;
    }

    .hero-headline a {
      color: inherit;
      text-decoration: none;
      background-image: linear-gradient(var(--accent), var(--accent));
      background-size: 0 2px;
      background-position: 0 100%;
      background-repeat: no-repeat;
      transition: background-size 0.4s ease;
    }

    .hero-headline a:hover {
      background-size: 100% 2px;
    }

    .hero-excerpt {
      font-size: 1.15rem;
      color: var(--text-secondary);
      line-height: 1.7;
      max-width: 600px;
      font-style: italic;
    }

    .hero-footer {
      display: flex;
      align-items: center;
      gap: 2rem;
      padding-top: 2rem;
      border-top: 1px solid var(--border);
    }

    .hero-meta {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .hero-meta span {
      color: var(--text-secondary);
    }

    .hero-tags {
      display: flex;
      gap: 0.5rem;
    }

    .hero-tag {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      color: var(--text-secondary);
      padding: 0.35rem 0.7rem;
      background: var(--bg-deep);
      border: 1px solid var(--border);
      border-radius: 6px;
      text-transform: lowercase;
      letter-spacing: 0.02em;
      transition: all 0.2s;
    }

    .hero-tag:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    /* Hero Sidebar */
    .hero-sidebar {
      background: var(--bg-surface);
      padding: 2rem;
      display: flex;
      flex-direction: column;
    }

    .sidebar-header {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      font-weight: 500;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .stat-item {
      padding: 1rem;
      background: var(--bg-elevated);
      position: relative;
    }

    .stat-item::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 2px;
      height: 100%;
      background: var(--accent);
      opacity: 0;
      transition: opacity 0.3s;
    }

    .stat-item:hover::before {
      opacity: 1;
    }

    .stat-number {
      font-family: var(--font-main);
      font-size: 2rem;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1;
      margin-bottom: 0.25rem;
    }

    .stat-label {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    /* Filters & Tabs */
    .filters-section {
      padding: 1.5rem 3rem;
      border-bottom: 1px solid var(--border);
      background: var(--bg-surface);
    }

    .filters-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .tab-buttons {
      display: flex;
      gap: 0.5rem;
    }

    .tab-btn {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      font-weight: 500;
      padding: 0.6rem 1.2rem;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .tab-btn:hover {
      background: var(--bg-elevated);
      border-color: var(--border-hover);
    }

    .tab-btn.active {
      background: var(--accent-subtle);
      border-color: var(--accent);
      color: var(--accent);
    }

    .tab-count {
      font-size: 0.7rem;
      padding: 0.15rem 0.5rem;
      background: var(--bg-deep);
      border-radius: 10px;
      color: var(--text-muted);
    }

    .tab-btn.active .tab-count {
      background: rgba(249, 115, 22, 0.2);
      color: var(--accent);
    }

    .tag-filters {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .tag-filters::-webkit-scrollbar {
      display: none;
    }

    .filter-label {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      white-space: nowrap;
    }

    .tag-btn {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      padding: 0.35rem 0.7rem;
      background: var(--bg-deep);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .tag-btn:hover, .tag-btn.active {
      background: var(--bg-elevated);
      border-color: var(--accent);
      color: var(--accent);
    }

    .hidden {
      display: none !important;
    }

    /* Articles Grid - Magazine Style 2-Column Layout */
    .articles-section {
      padding: 4rem 5rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 3rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }

    .section-title {
      font-family: var(--font-main);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    .section-count {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .articles-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 3rem 2.5rem;
    }

    .article-card {
      background: var(--bg-surface);
      display: flex;
      flex-direction: column;
      min-height: auto;
      position: relative;
      border: 1px solid var(--border);
      border-radius: 16px;
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 20px var(--card-shadow);
      overflow: hidden;
    }

    .article-card:not(.has-image) {
      padding: 2.5rem;
    }

    .article-card.has-image .article-content {
      padding: 1.5rem 2rem 2rem;
    }

    .article-card:hover {
      background: var(--bg-elevated);
      border-color: rgba(249, 115, 22, 0.3);
      transform: translateY(-6px);
      box-shadow: 0 20px 50px var(--card-shadow-hover), 0 0 0 1px rgba(249, 115, 22, 0.1);
    }

    .article-card::before {
      content: attr(data-index);
      font-family: var(--font-mono);
      font-size: 0.7rem;
      color: var(--text-muted);
      position: absolute;
      top: 1.5rem;
      right: 1.5rem;
      opacity: 0.4;
      z-index: 1;
    }

    .article-card.has-image::before {
      background: var(--bg-surface);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .article-image {
      width: 100%;
      height: 200px;
      overflow: hidden;
      background: var(--bg-inset);
    }

    .article-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top;
      transition: transform 0.3s ease;
    }

    .article-image.error {
      display: none;
    }

    .article-card.has-image:has(.article-image.error) {
      padding: 2.5rem;
    }

    .article-card.has-image:has(.article-image.error) .article-content {
      padding: 0;
    }

    .article-card:hover .article-image img {
      transform: scale(1.05);
    }

    .article-content {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    }

    .article-meta-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .article-difficulty {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 0.9rem;
      border-radius: 6px;
    }

    .difficulty-beginner { 
      color: #22c55e;
      background: rgba(34, 197, 94, 0.2); 
      border: 1px solid rgba(34, 197, 94, 0.4);
      text-shadow: 0 0 20px rgba(34, 197, 94, 0.5);
    }
    .difficulty-intermediate { 
      color: #facc15;
      background: rgba(250, 204, 21, 0.2); 
      border: 1px solid rgba(250, 204, 21, 0.4);
      text-shadow: 0 0 20px rgba(250, 204, 21, 0.5);
    }
    .difficulty-advanced { 
      color: #ef4444;
      background: rgba(239, 68, 68, 0.2); 
      border: 1px solid rgba(239, 68, 68, 0.4);
      text-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
    }

    .article-headline {
      font-family: var(--font-main);
      font-size: 1.5rem;
      font-weight: 600;
      line-height: 1.4;
      margin-bottom: 1rem;
      letter-spacing: -0.01em;
    }

    .article-headline a {
      color: var(--text-primary);
      text-decoration: none;
      transition: color 0.2s;
    }

    .article-headline a:hover {
      color: var(--accent);
    }

    .article-tldr {
      font-size: 1rem;
      color: var(--text-secondary);
      line-height: 1.75;
      margin-bottom: 1.5rem;
    }

    .article-key-points {
      margin-bottom: 1.25rem;
      padding: 1.25rem;
      background: var(--bg-inset);
      border-radius: 10px;
      border: 1px solid var(--border);
    }

    .key-point-item {
      font-family: var(--font-main);
      font-size: 0.9rem;
      color: var(--text-secondary);
      padding: 0.5rem 0;
      padding-left: 1.5rem;
      position: relative;
      line-height: 1.6;
    }

    .key-point-item::before {
      content: '→';
      position: absolute;
      left: 0;
      color: var(--accent);
      font-size: 0.85rem;
    }

    .article-why-matters {
      background: var(--bg-inset);
      padding: 1rem 1.25rem;
      margin-bottom: 1.25rem;
      border-radius: 10px;
      border: 1px dashed var(--border);
    }

    .why-label {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 0.4rem;
      font-weight: 500;
    }

    .why-text {
      font-size: 0.9rem;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    .article-quote {
      color: var(--text-secondary);
      font-size: 0.9rem;
      padding: 1rem 1.25rem;
      background: var(--bg-inset);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 1.25rem;
      line-height: 1.6;
      position: relative;
      margin-left: 0.5rem;
    }

    .article-quote::before {
      content: '"';
      position: absolute;
      left: -0.25rem;
      top: 0.25rem;
      font-size: 2rem;
      color: var(--text-muted);
      opacity: 0.5;
      font-family: Georgia, serif;
      line-height: 1;
    }

    .article-footer {
      margin-top: auto;
      padding-top: 1.25rem;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .article-source-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .article-source-label {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--accent);
      background: var(--accent-subtle);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .article-source-divider {
      color: var(--text-muted);
    }

    .article-source {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .article-reading-time {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-muted);
      background: var(--bg-inset);
      border: 1px solid var(--border);
      padding: 0.35rem 0.65rem;
      border-radius: 6px;
    }

    .article-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .article-tag {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      color: var(--text-secondary);
      padding: 0.35rem 0.7rem;
      background: var(--bg-deep);
      border-radius: 6px;
      border: 1px solid var(--border);
      transition: all 0.2s;
    }

    .article-tag:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .read-toggle-btn {
      position: absolute;
      top: 1rem;
      left: 1rem;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 2px solid var(--border);
      background: var(--bg-surface);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      z-index: 2;
    }

    .read-toggle-btn::after {
      content: 'Mark as read';
      position: absolute;
      left: 100%;
      margin-left: 8px;
      padding: 4px 8px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 0.65rem;
      color: var(--text-secondary);
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
    }

    .read-toggle-btn:hover::after {
      opacity: 1;
    }

    .read-toggle-btn:hover {
      border-color: var(--accent);
      background: var(--accent-subtle);
    }

    .read-toggle-btn svg {
      width: 14px;
      height: 14px;
      color: var(--text-muted);
      opacity: 0;
      transition: opacity 0.2s;
    }

    .read-toggle-btn:hover svg {
      opacity: 0.6;
      color: var(--accent);
    }

    .article-card[data-read="true"] .read-toggle-btn {
      border-color: var(--accent);
      background: var(--accent);
    }

    .article-card[data-read="true"] .read-toggle-btn::after {
      content: 'Mark as unread';
    }

    .article-card[data-read="true"] .read-toggle-btn svg {
      color: white;
      opacity: 1;
    }

    .article-card[data-read="true"] .read-toggle-btn:hover {
      background: var(--accent-subtle);
      border-color: var(--accent);
    }

    .article-card[data-read="true"] .read-toggle-btn:hover svg {
      color: var(--accent);
    }

    /* Footer */
    footer {
      padding: 4rem 3rem;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .footer-brand {
      font-family: var(--font-main);
      font-size: 0.7rem;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    .footer-brand a {
      color: var(--accent);
      text-decoration: none;
    }

    .footer-brand a:hover {
      text-decoration: underline;
    }

    .footer-info {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      color: var(--text-muted);
    }

    /* Animations */
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .article-card {
      animation: fadeInUp 0.6s ease forwards;
      opacity: 0;
    }

    .article-card:nth-child(1) { animation-delay: 0.1s; }
    .article-card:nth-child(2) { animation-delay: 0.2s; }
    .article-card:nth-child(3) { animation-delay: 0.3s; }
    .article-card:nth-child(4) { animation-delay: 0.4s; }
    .article-card:nth-child(5) { animation-delay: 0.5s; }
    .article-card:nth-child(6) { animation-delay: 0.6s; }

    /* Responsive */
    @media (max-width: 1100px) {
      .articles-section {
        padding: 3rem;
      }

      .articles-grid {
        gap: 2.5rem 2rem;
      }

      .article-card {
        padding: 2rem;
      }

      .article-headline {
        font-size: 1.35rem;
      }
    }

    @media (max-width: 900px) {
      .hero {
        grid-template-columns: 1fr;
        min-height: auto;
      }

      .hero-main {
        border-right: none;
        border-bottom: 1px solid var(--border);
      }

      .hero-sidebar {
        padding: 2rem 3rem;
      }

      .stats-grid {
        grid-template-columns: repeat(4, 1fr);
      }

      .articles-grid {
        grid-template-columns: 1fr;
        gap: 2rem;
      }

      .article-card {
        max-width: 640px;
      }
    }

    @media (max-width: 768px) {
      .masthead {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
        padding: 1.5rem 1.5rem;
      }

      .masthead::after {
        left: 1.5rem;
      }

      .masthead-meta {
        text-align: left;
      }

      .hero {
        display: block;
      }

      .hero-main {
        padding: 1.5rem;
        border-bottom: 1px solid var(--border);
      }

      .hero-main::before {
        top: 1.5rem;
        left: 1.5rem;
        font-size: 0.6rem;
        padding: 0.25rem 0.5rem;
      }

      .hero-content {
        margin-top: 2.5rem;
      }

      .hero-headline {
        font-size: 1.5rem;
        margin-bottom: 1rem;
      }

      .hero-excerpt {
        font-size: 1rem;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .hero-footer {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
        padding-top: 1rem;
      }

      .hero-sidebar {
        padding: 1.5rem;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 1.5rem;
      }

      .sidebar-header {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
        white-space: nowrap;
      }

      .stats-grid {
        display: flex;
        gap: 1.5rem;
        margin-bottom: 0;
      }

      .stat-item {
        padding: 0;
        background: none;
        display: flex;
        align-items: baseline;
        gap: 0.4rem;
      }

      .stat-item::before {
        display: none;
      }

      .stat-number {
        font-size: 1.25rem;
      }

      .stat-label {
        font-size: 0.6rem;
      }

      .filters-section {
        padding: 1rem 1.5rem;
      }

      .articles-section {
        padding: 2rem 1.5rem;
      }

      .section-header {
        margin-bottom: 2rem;
      }

      .articles-grid {
        gap: 1.5rem;
      }

      .article-card {
        border-radius: 12px;
        max-width: none;
      }

      .article-card:not(.has-image) {
        padding: 1.75rem;
      }

      .article-card.has-image .article-content {
        padding: 1.25rem 1.5rem 1.5rem;
      }

      .article-image {
        height: 160px;
      }

      .article-headline {
        font-size: 1.25rem;
      }

      .article-tldr {
        font-size: 0.95rem;
      }

      .article-key-points {
        padding: 1rem;
      }

      .key-point-item {
        font-size: 0.85rem;
      }

      .article-source-info {
        flex-wrap: wrap;
      }

      footer {
        flex-direction: column;
        gap: 1rem;
        padding: 2rem 1.5rem;
      }
    }

    /* Empty state */
    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 6rem 2rem;
      color: var(--text-muted);
    }

    .empty-state-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      opacity: 0.3;
    }

    .empty-state-text {
      font-family: var(--font-mono);
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <header class="masthead">
    <div class="brand">
      <span class="brand-name">LinkPress</span>
      <h1 class="issue-title">Tech Briefing</h1>
    </div>
    <div class="masthead-right">
      <div class="masthead-meta">
        <div>${dateStr}</div>
        <div>${articles.length} articles curated</div>
      </div>
      <button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme">
        <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
        <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </button>
    </div>
  </header>

  ${featuredHtml}

  <section class="filters-section">
    <div class="filters-row">
      <div class="tab-buttons">
        <button class="tab-btn active" data-tab="unread">Unread <span class="tab-count" id="unread-count">${unreadArticles.length}</span></button>
        <button class="tab-btn" data-tab="read">Read <span class="tab-count" id="read-count">${readArticles.length}</span></button>
      </div>
      <div class="tag-filters">
        <span class="filter-label">Filter by</span>
        <button class="tag-btn active" data-tag="all">All</button>
        ${tagFilters}
      </div>
    </div>
  </section>

  <main class="articles-section">
    <div class="section-header">
      <h2 class="section-title">Latest Articles</h2>
      <span class="section-count" id="section-count">${remainingUnread.length} stories</span>
    </div>
    <div class="articles-grid" id="unread-grid">
      ${unreadCards}
    </div>
    <div class="articles-grid hidden" id="read-grid">
      ${readCards}
    </div>
    <div class="empty-state hidden" id="empty-unread">
      <div class="empty-state-icon">◯</div>
      <p class="empty-state-text">No unread articles. All caught up!</p>
    </div>
    <div class="empty-state hidden" id="empty-read">
      <div class="empty-state-icon">✓</div>
      <p class="empty-state-text">No read articles yet.</p>
    </div>
  </main>

  <footer>
    <div class="footer-brand">
      Curated by <a href="https://github.com/mindori/linkpress">LinkPress</a>
    </div>
    <div class="footer-info">
      <span id="footer-reading-time">${unreadReadingTime}</span> min total reading time
    </div>
  </footer>

  <script>
    (function() {
      const html = document.documentElement;
      const themeToggle = document.getElementById('theme-toggle');
      const THEME_KEY = 'linkpress-theme';

      function getPreferredTheme() {
        const stored = localStorage.getItem(THEME_KEY);
        if (stored) return stored;
        return 'light';
      }

      function setTheme(theme) {
        html.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
      }

      setTheme(getPreferredTheme());

      themeToggle.addEventListener('click', () => {
        const current = html.getAttribute('data-theme') || 'light';
        setTheme(current === 'dark' ? 'light' : 'dark');
      });

      let currentTab = 'unread';
      const unreadGrid = document.getElementById('unread-grid');
      const readGrid = document.getElementById('read-grid');
      const emptyUnread = document.getElementById('empty-unread');
      const emptyRead = document.getElementById('empty-read');
      const unreadCountEl = document.getElementById('unread-count');
      const readCountEl = document.getElementById('read-count');
      const sectionCount = document.getElementById('section-count');
      const footerReadingTime = document.getElementById('footer-reading-time');
      const statsArticles = document.querySelector('.stat-number');
      const statsMinutes = document.querySelectorAll('.stat-number')[1];

      function updateEmptyStates() {
        const unreadCards = unreadGrid.querySelectorAll('.article-card');
        const readCards = readGrid.querySelectorAll('.article-card');

        if (currentTab === 'unread') {
          emptyUnread.classList.toggle('hidden', unreadCards.length > 0);
          emptyRead.classList.add('hidden');
        } else {
          emptyRead.classList.toggle('hidden', readCards.length > 0);
          emptyUnread.classList.add('hidden');
        }
      }

      function updateStats() {
        const unreadCards = unreadGrid.querySelectorAll('.article-card');
        const readCards = readGrid.querySelectorAll('.article-card');
        
        let unreadTime = 0;
        unreadCards.forEach(card => {
          unreadTime += parseInt(card.dataset.readingTime) || 0;
        });

        const featuredTime = parseInt(document.querySelector('.hero')?.dataset?.readingTime) || 0;
        const totalUnread = unreadCards.length + (document.querySelector('.hero[data-read="false"]') ? 1 : 0);
        const totalUnreadTime = unreadTime + featuredTime;

        unreadCountEl.textContent = unreadCards.length;
        readCountEl.textContent = readCards.length;
        
        if (currentTab === 'unread') {
          sectionCount.textContent = unreadCards.length + ' stories';
        } else {
          sectionCount.textContent = readCards.length + ' stories';
        }

        footerReadingTime.textContent = totalUnreadTime;
        if (statsArticles) statsArticles.textContent = totalUnread;
        if (statsMinutes) statsMinutes.textContent = totalUnreadTime;

        updateEmptyStates();
      }

      function switchTab(tab) {
        currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        if (tab === 'unread') {
          unreadGrid.classList.remove('hidden');
          readGrid.classList.add('hidden');
        } else {
          unreadGrid.classList.add('hidden');
          readGrid.classList.remove('hidden');
        }

        updateStats();
      }

      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
      });

      document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const tag = btn.dataset.tag;
          const grid = currentTab === 'unread' ? unreadGrid : readGrid;
          grid.querySelectorAll('.article-card').forEach(card => {
            if (tag === 'all' || card.dataset.tags.includes(tag)) {
              card.style.display = 'flex';
            } else {
              card.style.display = 'none';
            }
          });
        });
      });

      async function toggleRead(card) {
        const id = card.dataset.id;
        const isRead = card.dataset.read === 'true';
        const method = isRead ? 'DELETE' : 'POST';

        try {
          const res = await fetch('/api/articles/' + id + '/read', { method });
          if (!res.ok) throw new Error('API error');

          card.dataset.read = isRead ? 'false' : 'true';
          
          if (isRead) {
            readGrid.removeChild(card);
            unreadGrid.appendChild(card);
          } else {
            unreadGrid.removeChild(card);
            readGrid.appendChild(card);
          }

          updateStats();
        } catch (err) {
          console.error('Failed to toggle read status:', err);
        }
      }

      document.querySelectorAll('.read-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const card = btn.closest('.article-card');
          toggleRead(card);
        });
      });
    })();
  </script>
</body>
</html>`;
}

interface IssueStats {
  totalArticles: number;
  totalReadingTime: number;
}

function renderFeaturedCard(article: Article, stats: IssueStats): string {
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
  const tags = article.tags.slice(0, 3);

  const isRead = !!article.readAt;
  const readingTime = article.readingTimeMinutes || 0;

  return `
    <section class="hero" data-read="${isRead}" data-reading-time="${readingTime}">
      <div class="hero-main">
        <div class="hero-content">
          <h2 class="hero-headline">
            <a href="${article.url}" target="_blank" rel="noopener">${escapeHtml(headline)}</a>
          </h2>
          ${tldr ? `<p class="hero-excerpt">${escapeHtml(tldr)}</p>` : ''}
        </div>
        <div class="hero-footer">
          <div class="hero-meta">
            <span>${escapeHtml(hostname)}</span> · ${readingTime || '?'} min read
          </div>
          <div class="hero-tags">
            ${tags.map(tag => `<span class="hero-tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
        </div>
      </div>
      <aside class="hero-sidebar">
        <div class="sidebar-header">Issue Stats</div>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-number">${stats.totalArticles}</div>
            <div class="stat-label">Articles</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${stats.totalReadingTime}</div>
            <div class="stat-label">Minutes</div>
          </div>
        </div>
      </aside>
    </section>
  `;
}

function renderArticleCard(article: Article, index: number): string {
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
  const keyPoints = summary?.keyPoints?.slice(0, 3) || [];
  const whyItMatters = summary?.whyItMatters || '';
  const keyQuote = summary?.keyQuote || '';
  const difficulty = article.difficulty || 'intermediate';
  const sourceLabel = article.sourceLabel || 'Article';

  const difficultyLabel = { beginner: '입문', intermediate: '중급', advanced: '심화' }[difficulty];
  const difficultyClass = `difficulty-${difficulty}`;
  const formattedIndex = String(index + 2).padStart(2, '0');

  const imageHtml = article.image ? `
    <div class="article-image">
      <img src="${escapeHtml(article.image)}" alt="" loading="lazy" onerror="this.onerror=null; this.parentElement.style.display='none'; this.closest('.article-card').classList.remove('has-image');" />
    </div>
  ` : '';

  const keyPointsHtml = keyPoints.length > 0 ? `
    <div class="article-key-points">
      ${keyPoints.map(point => `<div class="key-point-item">${escapeHtml(point)}</div>`).join('')}
    </div>
  ` : '';

  const whyMattersHtml = whyItMatters ? `
    <div class="article-why-matters">
      <div class="why-label">Why it matters</div>
      <div class="why-text">${escapeHtml(whyItMatters)}</div>
    </div>
  ` : '';

  const keyQuoteHtml = keyQuote ? `
    <div class="article-quote">"${escapeHtml(keyQuote)}"</div>
  ` : '';

  const isRead = !!article.readAt;
  const readingTime = article.readingTimeMinutes || 0;

  return `
    <article class="article-card ${article.image ? 'has-image' : ''}" data-tags="${article.tags.join(',')}" data-index="${formattedIndex}" data-id="${article.id}" data-read="${isRead}" data-reading-time="${readingTime}">
      <button class="read-toggle-btn" aria-label="Mark as ${isRead ? 'unread' : 'read'}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </button>
      ${imageHtml}
      <div class="article-content">
        <div class="article-meta-row">
          <span class="article-difficulty ${difficultyClass}">${difficultyLabel}</span>
          <span class="article-reading-time">${readingTime || '?'} min read</span>
        </div>

        <h3 class="article-headline">
          <a href="${article.url}" target="_blank" rel="noopener">${escapeHtml(headline)}</a>
        </h3>

        ${tldr ? `<p class="article-tldr">${escapeHtml(tldr)}</p>` : ''}
        ${keyPointsHtml}
        ${whyMattersHtml}
        ${keyQuoteHtml}

        <div class="article-footer">
          <div class="article-source-info">
            <span class="article-source-label">${escapeHtml(sourceLabel)}</span>
            <span class="article-source-divider">·</span>
            <span class="article-source">${escapeHtml(hostname)}</span>
          </div>
        </div>

        <div class="article-tags">
          ${article.tags.slice(0, 5).map(tag => `<span class="article-tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
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
