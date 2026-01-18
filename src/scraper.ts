import * as cheerio from 'cheerio';

export interface ScrapedContent {
  title: string;
  description: string;
  content: string;
  siteName?: string;
  image?: string;
  sourceLabel?: string;
}

export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return parseHtml(html, url);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to scrape ${url}: ${error.message}`);
    }
    throw error;
  }
}

function parseHtml(html: string, url: string): ScrapedContent {
  const $ = cheerio.load(html);

  $('script, style, nav, footer, header, aside, .ads, .advertisement, .sidebar').remove();

  const title = 
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').text() ||
    '';

  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    $('meta[name="twitter:description"]').attr('content') ||
    '';

  const siteName =
    $('meta[property="og:site_name"]').attr('content') ||
    new URL(url).hostname.replace('www.', '');

  const image = extractImage($, url);
  const sourceLabel = detectSourceLabel(url);

  let content = '';
  
  const articleSelectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
  ];

  for (const selector of articleSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      content = element.text();
      break;
    }
  }

  if (!content) {
    content = $('body').text();
  }

  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
    .substring(0, 10000);

  return {
    title: title.trim(),
    description: description.trim(),
    content,
    siteName,
    image,
    sourceLabel,
  };
}

function extractImage($: cheerio.CheerioAPI, url: string): string | undefined {
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) {
    return resolveUrl(ogImage, url);
  }

  const twitterImage = $('meta[name="twitter:image"]').attr('content');
  if (twitterImage) {
    return resolveUrl(twitterImage, url);
  }

  const articleSelectors = ['article', '[role="main"]', 'main', '.post-content', '.article-content'];
  for (const selector of articleSelectors) {
    const img = $(`${selector} img`).first();
    const src = img.attr('src') || img.attr('data-src');
    if (src && !isIconOrLogo(src)) {
      return resolveUrl(src, url);
    }
  }

  return undefined;
}

function resolveUrl(imgUrl: string, baseUrl: string): string {
  if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
    return imgUrl;
  }
  if (imgUrl.startsWith('//')) {
    return 'https:' + imgUrl;
  }
  try {
    return new URL(imgUrl, baseUrl).href;
  } catch {
    return imgUrl;
  }
}

function isIconOrLogo(src: string): boolean {
  const lower = src.toLowerCase();
  return lower.includes('logo') || 
         lower.includes('icon') || 
         lower.includes('avatar') ||
         lower.includes('favicon') ||
         lower.includes('badge') ||
         lower.endsWith('.svg') ||
         lower.includes('1x1') ||
         lower.includes('pixel');
}

function detectSourceLabel(url: string): string {
  const hostname = new URL(url).hostname.toLowerCase();
  
  const labelMap: Record<string, string> = {
    'medium.com': 'Blog',
    'dev.to': 'Blog',
    'hashnode.dev': 'Blog',
    'velog.io': 'Blog',
    'tistory.com': 'Blog',
    'brunch.co.kr': 'Blog',
    'substack.com': 'Newsletter',
    'github.com': 'GitHub',
    'github.io': 'Blog',
    'linkedin.com': 'LinkedIn',
    'twitter.com': 'Twitter',
    'x.com': 'Twitter',
    'reddit.com': 'Reddit',
    'news.ycombinator.com': 'HackerNews',
    'stackoverflow.com': 'StackOverflow',
    'youtube.com': 'YouTube',
    'youtu.be': 'YouTube',
    'notion.so': 'Notion',
    'notion.site': 'Notion',
    'news.hada.io': 'News',
  };

  for (const [domain, label] of Object.entries(labelMap)) {
    if (hostname.includes(domain)) {
      return label;
    }
  }

  if (hostname.includes('blog') || url.includes('/blog/')) {
    return 'Blog';
  }

  return 'Article';
}

export function estimateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}
