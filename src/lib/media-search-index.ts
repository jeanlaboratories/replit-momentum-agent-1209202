/**
 * Media Search Indexing Utilities
 *
 * Handles indexing media to Vertex AI Discovery Engine for semantic search.
 * This is a fire-and-forget operation - failures are logged but don't break the flow.
 */

const PYTHON_SERVICE_URL = process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';

export interface MediaItem {
  id: string;
  brandId: string;
  type: 'image' | 'video';
  url: string;
  title: string;
  description?: string;
  tags?: string[];
  collections?: string[];
  source?: string;
  prompt?: string;
  thumbnailUrl?: string;
  explainability?: {
    summary?: string;
    brandElements?: string[];
  };
  createdAt?: string;
  createdBy?: string;
}

/**
 * Index a single media item to Vertex AI Search.
 * This is non-blocking and won't throw errors.
 */
export async function indexMediaItem(brandId: string, mediaItem: MediaItem): Promise<void> {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/agent/media-index-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: brandId,
        media_item: mediaItem,
      }),
    });

    if (!response.ok) {
      console.warn(`[MediaIndex] Failed to index media ${mediaItem.id}: ${response.status}`);
    }
  } catch (error) {
    console.warn(`[MediaIndex] Error indexing media ${mediaItem.id}:`, error);
  }
}

/**
 * Index all media for a brand to Vertex AI Search.
 * Use this to rebuild the search index.
 */
export async function indexAllBrandMedia(brandId: string): Promise<{
  success: boolean;
  message: string;
  indexedCount?: number;
}> {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/agent/media-index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: brandId,
        index_all: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `Failed to index media: ${response.status} ${errorText}`,
      };
    }

    const data = await response.json();
    return {
      success: data.status === 'success',
      message: data.message,
      indexedCount: data.indexed_count,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error indexing media: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Fire-and-forget indexing - use this after media creation.
 * Does not await the result.
 */
export function indexMediaItemAsync(brandId: string, mediaItem: MediaItem): void {
  indexMediaItem(brandId, mediaItem).catch(() => {
    // Silently ignore errors - indexing is best-effort
  });
}
