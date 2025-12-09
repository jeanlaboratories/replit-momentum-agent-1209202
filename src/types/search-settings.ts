/**
 * TypeScript types for Search Settings functionality
 */

export enum SearchMethod {
  VERTEX_AI = 'vertex_ai',
  FIREBASE = 'firebase'
}

export enum DataStoreStatus {
  ACTIVE = 'active',
  CREATING = 'creating',
  DELETING = 'deleting',
  ERROR = 'error',
  NOT_FOUND = 'not_found'
}

export interface DataStoreInfo {
  id: string
  name: string
  display_name: string
  brand_id: string
  status: DataStoreStatus
  document_count: number
  created_at?: string
  last_indexed?: string
  size_bytes?: number
}

export interface SearchSettings {
  brand_id: string
  search_method: SearchMethod
  auto_index: boolean
  vertex_ai_enabled: boolean
  data_store_info?: DataStoreInfo
  firebase_document_count: number
  last_sync?: string
}

export interface SearchSettingsUpdateRequest {
  search_method?: SearchMethod
  auto_index?: boolean
}

export interface DataStoreDeleteRequest {
  brand_id: string
  confirm_deletion: boolean
}

export interface DataStoreCreateRequest {
  brand_id: string
  force_recreate?: boolean
}

export interface SearchStatsResponse {
  total_searches: number
  vertex_ai_searches: number
  firebase_searches: number
  avg_response_time: number
  success_rate: number
}

export interface IndexingStatus {
  is_indexing: boolean
  progress: number
  items_processed: number
  total_items: number
  started_at?: string
  estimated_completion?: string
  current_operation: string
}

export interface SearchSettingsResponse {
  success: boolean
  message: string
  processing_time_ms?: number
  switched_to_firebase?: boolean
  switched_to_vertex_ai?: boolean
  datastore_name?: string
  existing_store?: DataStoreInfo
}