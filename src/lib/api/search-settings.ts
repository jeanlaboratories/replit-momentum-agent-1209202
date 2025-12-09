/**
 * API client for Search Settings management
 * Uses Next.js API routes to proxy requests to the Python backend
 */

import {
  SearchSettings,
  SearchSettingsUpdateRequest,
  DataStoreDeleteRequest,
  DataStoreCreateRequest,
  SearchStatsResponse,
  IndexingStatus,
  SearchSettingsResponse
} from '@/types/search-settings'

/**
 * Get current search settings for a brand
 */
export async function getSearchSettings(brandId: string): Promise<SearchSettings> {
  const response = await fetch(`/api/search-settings/${brandId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get search settings: ${error}`)
  }

  return response.json()
}

/**
 * Update search settings for a brand
 */
export async function updateSearchSettings(
  brandId: string,
  updates: SearchSettingsUpdateRequest
): Promise<SearchSettings> {
  const response = await fetch(`/api/search-settings/${brandId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update search settings: ${error}`)
  }

  return response.json()
}

/**
 * Delete a brand's Vertex AI data store
 */
export async function deleteDataStore(
  request: DataStoreDeleteRequest
): Promise<SearchSettingsResponse> {
  const response = await fetch(`/api/search-settings/${request.brand_id}/datastore`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to delete data store: ${error}`)
  }

  return response.json()
}

/**
 * Create or recreate a brand's Vertex AI data store
 */
export async function createDataStore(
  request: DataStoreCreateRequest
): Promise<SearchSettingsResponse> {
  const response = await fetch(`/api/search-settings/${request.brand_id}/datastore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create data store: ${error}`)
  }

  return response.json()
}

/**
 * Trigger reindexing of media for a brand
 * Now uses the generation job queue for tracking
 */
export async function reindexMedia(
  brandId: string,
  force: boolean = false
): Promise<{ success: boolean; message: string; jobId: string }> {
  const response = await fetch('/api/generation/media-reindex', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ brandId, force }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to trigger reindexing: ${error}`)
  }

  return response.json()
}

/**
 * Get current indexing status for a brand
 */
export async function getIndexingStatus(brandId: string): Promise<IndexingStatus> {
  const response = await fetch(`/api/search-settings/${brandId}/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get indexing status: ${error}`)
  }

  return response.json()
}

/**
 * Get search statistics for a brand
 */
export async function getSearchStats(brandId: string): Promise<SearchStatsResponse> {
  const response = await fetch(`/api/search-settings/${brandId}/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get search stats: ${error}`)
  }

  return response.json()
}
