import fs from 'fs';
import path from 'path';
import os from 'os';
import YAML from 'yaml';
import type { Config } from './types.js';

const CONFIG_DIR = path.join(os.homedir(), '.linkpress');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml');
const DB_FILE = path.join(CONFIG_DIR, 'linkpress.db');

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getDbPath(): string {
  return DB_FILE;
}

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getDefaultConfig(): Config {
  return {
    sources: {},
    ai: {
      provider: 'anthropic',
      model: '',
      language: 'English',
    },
    output: {
      directory: path.join(CONFIG_DIR, 'output'),
      format: 'html',
    },
    filter: {
      skipOutdated: false,
    },
  };
}

export function loadConfig(): Config {
  ensureConfigDir();
  
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = getDefaultConfig();
    saveConfig(defaultConfig);
    return defaultConfig;
  }
  
  const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
  return YAML.parse(content) as Config;
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, YAML.stringify(config), 'utf-8');
}
