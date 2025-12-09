const FIRECRAWL_API_KEY = process.env.MOMENTUM_FIRECRAWL_API_KEY;
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

export interface CrawlResult {
  success: boolean;
  url: string;
  title?: string;
  content?: string;
  error?: string;
}

export async function crawlWebsite(url: string): Promise<CrawlResult> {
  if (!FIRECRAWL_API_KEY) {
    return {
      success: false,
      url,
      error: 'Firecrawl API key not configured',
    };
  }

  try {
    const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        url,
        error: `Firecrawl API error: ${response.status} - ${errorText}`,
      };
    }

    const scrapeResult = await response.json();

    if (!scrapeResult || !scrapeResult.success) {
      return {
        success: false,
        url,
        error: scrapeResult?.error || 'Failed to crawl website',
      };
    }

    const data = scrapeResult.data || {};
    const metadata = data.metadata || {};
    const markdown = data.markdown || '';

    let content = markdown.slice(0, 10000);
    
    if (markdown.length > 10000) {
      content += '\n\n[Content truncated for brevity...]';
    }

    return {
      success: true,
      url,
      title: (metadata.title as string) || url,
      content,
    };
  } catch (error) {
    console.error('Firecrawl error:', error);
    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export function extractUrlsFromMessage(message: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = message.match(urlRegex);
  return matches || [];
}

export function formatCrawlResultForAI(result: CrawlResult): string {
  if (!result.success) {
    return `Failed to crawl ${result.url}: ${result.error}`;
  }

  return `
WEBSITE CRAWL RESULT:
URL: ${result.url}
Title: ${result.title}

Content:
${result.content}
`.trim();
}
