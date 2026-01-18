import Database from 'better-sqlite3';
import { getDbPath, ensureConfigDir } from './config.js';
import type { Article } from './types.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    ensureConfigDir();
    db = new Database(getDbPath());
    initSchema();
  }
  return db;
}

function initSchema(): void {
  const database = db!;
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      title TEXT,
      description TEXT,
      content TEXT,
      summary TEXT,
      tags TEXT,
      difficulty TEXT,
      reading_time_minutes INTEGER,
      image TEXT,
      source_label TEXT,
      source_type TEXT NOT NULL,
      source_id TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
    CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at);
  `);

  migrateSchema(database);
}

function migrateSchema(database: Database.Database): void {
  const columns = database.prepare("PRAGMA table_info(articles)").all() as Array<{ name: string }>;
  const columnNames = columns.map(c => c.name);

  if (!columnNames.includes('image')) {
    database.exec('ALTER TABLE articles ADD COLUMN image TEXT');
  }
  if (!columnNames.includes('source_label')) {
    database.exec('ALTER TABLE articles ADD COLUMN source_label TEXT');
  }
}

export function insertArticle(article: Article): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT OR IGNORE INTO articles (
      id, url, title, description, content, summary, tags, 
      difficulty, reading_time_minutes, source_type, source_id, 
      created_at, processed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    article.id,
    article.url,
    article.title,
    article.description ?? null,
    article.content ?? null,
    article.summary ?? null,
    JSON.stringify(article.tags),
    article.difficulty ?? null,
    article.readingTimeMinutes ?? null,
    article.sourceType,
    article.sourceId ?? null,
    article.createdAt.toISOString(),
    article.processedAt?.toISOString() ?? null
  );
}

export function getUnprocessedArticles(): Article[] {
  const database = getDb();
  const rows = database.prepare(`
    SELECT * FROM articles WHERE processed_at IS NULL ORDER BY created_at DESC
  `).all() as Record<string, unknown>[];
  
  return rows.map(rowToArticle);
}

export function getArticlesForReprocess(limit = 100): Article[] {
  const database = getDb();
  const rows = database.prepare(`
    SELECT * FROM articles ORDER BY created_at DESC LIMIT ?
  `).all(limit) as Record<string, unknown>[];
  
  return rows.map(rowToArticle);
}

export function getAllArticles(limit = 100): Article[] {
  const database = getDb();
  const rows = database.prepare(`
    SELECT * FROM articles ORDER BY created_at DESC LIMIT ?
  `).all(limit) as Record<string, unknown>[];
  
  return rows.map(rowToArticle);
}

export function updateArticle(article: Article): void {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE articles SET
      title = ?, description = ?, content = ?, summary = ?,
      tags = ?, difficulty = ?, reading_time_minutes = ?,
      image = ?, source_label = ?, processed_at = ?
    WHERE id = ?
  `);
  
  stmt.run(
    article.title,
    article.description ?? null,
    article.content ?? null,
    article.summary ?? null,
    JSON.stringify(article.tags),
    article.difficulty ?? null,
    article.readingTimeMinutes ?? null,
    article.image ?? null,
    article.sourceLabel ?? null,
    article.processedAt?.toISOString() ?? null,
    article.id
  );
}

export function articleExists(url: string): boolean {
  const database = getDb();
  const row = database.prepare('SELECT 1 FROM articles WHERE url = ?').get(url);
  return !!row;
}

export function clearAllArticles(): number {
  const database = getDb();
  const countResult = database.prepare('SELECT COUNT(*) as count FROM articles').get() as { count: number };
  const count = countResult.count;
  database.prepare('DELETE FROM articles').run();
  return count;
}

function rowToArticle(row: Record<string, unknown>): Article {
  return {
    id: row.id as string,
    url: row.url as string,
    title: row.title as string,
    description: row.description as string | undefined,
    content: row.content as string | undefined,
    summary: row.summary as string | undefined,
    tags: JSON.parse((row.tags as string) || '[]'),
    difficulty: row.difficulty as Article['difficulty'],
    readingTimeMinutes: row.reading_time_minutes as number | undefined,
    image: row.image as string | undefined,
    sourceLabel: row.source_label as string | undefined,
    sourceType: row.source_type as Article['sourceType'],
    sourceId: row.source_id as string | undefined,
    createdAt: new Date(row.created_at as string),
    processedAt: row.processed_at ? new Date(row.processed_at as string) : undefined,
  };
}
