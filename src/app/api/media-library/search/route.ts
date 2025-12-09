// Media Library - Search API
// Unified search across all media (images, videos, Brand Soul extracts)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import type { UnifiedMedia, MediaSearchRequest, MediaSearchResponse } from '@/lib/types/media-library';

export async function POST(request: NextRequest) {
  try {
    const body: MediaSearchRequest = await request.json();
    const { brandId, query, filters, sort = 'date-desc', cursor, limit = 50 } = body;

    if (!brandId) {
      return NextResponse.json(
        { success: false, message: 'Missing brandId' },
        { status: 400 }
      );
    }

    // Authentication & Authorization
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();
    
    // Build query
    let queryRef = adminDb
      .collection('unifiedMedia')
      .where('brandId', '==', brandId);

    // Apply filters
    if (filters?.type) {
      queryRef = queryRef.where('type', '==', filters.type);
    }

    if (filters?.source) {
      queryRef = queryRef.where('source', '==', filters.source);
    }

    if (filters?.createdBy) {
      queryRef = queryRef.where('createdBy', '==', filters.createdBy);
    }

    // Apply sorting
    if (sort === 'date-desc') {
      queryRef = queryRef.orderBy('createdAt', 'desc');
    } else if (sort === 'date-asc') {
      queryRef = queryRef.orderBy('createdAt', 'asc');
    } else if (sort === 'title') {
      queryRef = queryRef.orderBy('title', 'asc');
    }

    // Cursor pagination
    if (cursor) {
      try {
        const cursorDoc = await adminDb.collection('unifiedMedia').doc(cursor).get();
        if (cursorDoc.exists) {
          queryRef = queryRef.startAfter(cursorDoc);
        }
      } catch (error) {
        console.warn('[Media Search] Invalid cursor:', error);
      }
    }

    // Limit results
    queryRef = queryRef.limit(limit + 1);

    // Execute query
    const snapshot = await queryRef.get();
    const hasMore = snapshot.docs.length > limit;
    const items = snapshot.docs
      .slice(0, limit)
      .map((doc: any) => ({ id: doc.id, ...doc.data() } as UnifiedMedia));

    // Client-side filtering for arrays (tags, collections)
    let filteredItems = items;

    if (filters?.tags && filters.tags.length > 0) {
      filteredItems = filteredItems.filter((item: UnifiedMedia) =>
        filters.tags!.some((tag: string) => item.tags?.includes(tag))
      );
    }

    if (filters?.collections && filters.collections.length > 0) {
      filteredItems = filteredItems.filter((item: UnifiedMedia) =>
        filters.collections!.some((col: string) => item.collections?.includes(col))
      );
    }

    if (filters?.hasColors) {
      filteredItems = filteredItems.filter((item: UnifiedMedia) => item.colors && item.colors.length > 0);
    }

    if (filters?.hasExplainability) {
      filteredItems = filteredItems.filter((item: UnifiedMedia) => item.explainability);
    }

    // Text search with plural/singular handling - includes vision analysis
    if (query) {
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.trim().split(/\s+/).filter(w => w.length > 0);
      
      // Helper functions for plural/singular handling
      const getSingular = (word: string): string => {
        const lower = word.toLowerCase();
        const irregularSingulars: Record<string, string> = {
          'children': 'child', 'people': 'person', 'men': 'man', 'women': 'woman',
          'feet': 'foot', 'teeth': 'tooth', 'mice': 'mouse', 'geese': 'goose',
          'analyses': 'analysis', 'criteria': 'criterion', 'data': 'datum', 'media': 'medium',
        };
        if (irregularSingulars[lower]) return irregularSingulars[lower];
        if (lower.endsWith('ies') && lower.length > 3) return lower.slice(0, -3) + 'y';
        if (lower.endsWith('ves') && lower.length > 3) return lower.slice(0, -3) + 'f';
        if (lower.endsWith('es') && lower.length > 2) return lower.slice(0, -2);
        if (lower.endsWith('s') && lower.length > 1) return lower.slice(0, -1);
        return lower;
      };
      
      const getPlural = (word: string): string => {
        const lower = word.toLowerCase();
        const irregularPlurals: Record<string, string> = {
          'child': 'children', 'person': 'people', 'man': 'men', 'woman': 'women',
          'foot': 'feet', 'tooth': 'teeth', 'mouse': 'mice', 'goose': 'geese',
          'analysis': 'analyses', 'criterion': 'criteria', 'datum': 'data', 'medium': 'media',
        };
        if (irregularPlurals[lower]) return irregularPlurals[lower];
        if (lower.endsWith('y') && lower.length > 1 && !'aeiou'.includes(lower[lower.length - 2])) {
          return lower.slice(0, -1) + 'ies';
        }
        if (lower.endsWith('f')) return lower.slice(0, -1) + 'ves';
        if (lower.endsWith('fe')) return lower.slice(0, -2) + 'ves';
        if (['s', 'x', 'z', 'ch', 'sh'].some(s => lower.endsWith(s))) return lower + 'es';
        return lower + 's';
      };
      
      const getWordVariants = (word: string): Set<string> => {
        const variants = new Set<string>();
        const lower = word.toLowerCase();
        variants.add(lower);
        variants.add(getSingular(lower));
        variants.add(getPlural(lower));
        return variants;
      };
      
      const wordMatches = (queryWord: string, searchableText: string): boolean => {
        const queryLower = queryWord.toLowerCase();
        if (searchableText.includes(queryLower)) return true;
        const variants = getWordVariants(queryWord);
        for (const variant of variants) {
          if (variant !== queryLower && searchableText.includes(variant)) return true;
        }
        return false;
      };
      
      // Pre-compute word variants once for all items (performance optimization)
      const queryWordVariants = queryWords.map(word => {
        const variants = getWordVariants(word);
        return { original: word.toLowerCase(), variants };
      });
      
      filteredItems = filteredItems.filter((item: UnifiedMedia) => {
        // Build searchable text including vision analysis
        const searchableText = [
          item.title || '',
          item.description || '',
          item.prompt || '',
          ...(item.tags || []),
          item.visionDescription || '',
          ...(item.visionKeywords || []),
          ...(item.visionCategories || []),
          item.enhancedSearchText || '',
        ].join(' ').toLowerCase();
        
        // For multi-word queries, check if all words match (including plural/singular variants)
        if (queryWordVariants.length > 1) {
          return queryWordVariants.every(({ original, variants }) => {
            if (searchableText.includes(original)) return true;
            for (const variant of variants) {
              if (variant !== original && searchableText.includes(variant)) return true;
            }
            return false;
          });
        } else if (queryWordVariants.length === 1) {
          // Single word - check with variants
          const { original, variants } = queryWordVariants[0];
          if (searchableText.includes(original)) return true;
          for (const variant of variants) {
            if (variant !== original && searchableText.includes(variant)) return true;
          }
          return false;
        }
        return true;
      });
    }

    const response: MediaSearchResponse = {
      items: filteredItems,
      hasMore,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : undefined,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Media Search] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
