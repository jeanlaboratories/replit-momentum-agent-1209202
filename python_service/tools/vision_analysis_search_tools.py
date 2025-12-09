"""
Vision Analysis Search Tools

Tools for searching and retrieving detailed vision analysis data for media items.
These tools enable the Team Companion agent to access comprehensive vision analysis
information including descriptions, keywords, categories, and indexing status.
"""

import logging
import time
from typing import Dict, Any, Optional
from utils.context_utils import get_brand_context

logger = logging.getLogger(__name__)


def search_media_by_vision_analysis(
    query: str,
    brand_id: str = "",
    analysis_type: str = "",
    limit: int = 10,
) -> Dict[str, Any]:
    """
    Search media specifically by vision analysis content.

    Use this tool when users want to find media based on AI vision analysis data,
    such as visual descriptions, detected objects, colors, scenes, or categorized content.

    Examples of when to use this tool:
    - "Find images with red cars in them"
    - "Search for photos containing buildings"
    - "Look for media categorized as 'transportation'"
    - "Find images with specific visual elements"
    - "Search for media by AI-detected content"

    Args:
        query (str): Search query focusing on visual content or AI analysis.
        brand_id (str): Brand ID for scoped search. If empty, uses current context.
        analysis_type (str): Filter by analysis type: 'description', 'keywords', 'categories', or 'all'.
        limit (int): Maximum number of results to return (default: 10, max: 50).

    Returns:
        dict: Contains 'results' with detailed vision analysis data and search metadata.
    """
    try:
        import firebase_admin
        from firebase_admin import firestore

        # Get brand ID from parameter or context
        effective_brand_id = brand_id or get_brand_context()

        if not effective_brand_id:
            error_text = "Brand ID required for vision analysis search. Please ensure user is authenticated."
            return {
                "status": "error",
                "error": error_text,
                "content": error_text,
                "results": [],
                "total_count": 0
            }

        # Get Firestore client
        try:
            db = firestore.client()
        except ValueError:
            firebase_admin.initialize_app()
            db = firestore.client()

        start_time = time.time()

        # Query unifiedMedia collection for items with vision analysis
        collection_ref = db.collection('unifiedMedia')
        query_ref = collection_ref.where('brandId', '==', effective_brand_id)

        # Order by createdAt descending and fetch more for filtering
        query_ref = query_ref.order_by('createdAt', direction=firestore.Query.DESCENDING)
        query_ref = query_ref.limit(limit * 3)  # Fetch more to allow for filtering

        docs = query_ref.stream()
        query_lower = query.lower() if query else ""

        results = []
        vision_analyzed_count = 0
        total_media_count = 0

        for doc in docs:
            if len(results) >= limit:
                break

            total_media_count += 1
            media_data = doc.to_dict()
            media_data['id'] = doc.id

            # Check if media has vision analysis data
            has_vision_description = bool(media_data.get('visionDescription'))
            has_vision_keywords = bool(media_data.get('visionKeywords'))
            has_vision_categories = bool(media_data.get('visionCategories'))
            has_enhanced_search_text = bool(media_data.get('enhancedSearchText'))

            has_any_vision_analysis = (
                has_vision_description or has_vision_keywords or 
                has_vision_categories or has_enhanced_search_text
            )

            if has_any_vision_analysis:
                vision_analyzed_count += 1

            # If there's a search query, filter based on vision analysis content
            if query_lower and has_any_vision_analysis:
                vision_description = media_data.get('visionDescription') or ''
                vision_keywords = media_data.get('visionKeywords') or []
                vision_categories = media_data.get('visionCategories') or []
                enhanced_search_text = media_data.get('enhancedSearchText') or ''

                # Search within vision analysis data based on analysis_type
                match_found = False
                match_details = []

                if analysis_type in ['', 'all', 'description'] and vision_description:
                    if query_lower in vision_description.lower():
                        match_found = True
                        match_details.append(f"Description: {vision_description}")

                if analysis_type in ['', 'all', 'keywords'] and vision_keywords:
                    matching_keywords = [kw for kw in vision_keywords if query_lower in kw.lower()]
                    if matching_keywords:
                        match_found = True
                        match_details.append(f"Keywords: {', '.join(matching_keywords)}")

                if analysis_type in ['', 'all', 'categories'] and vision_categories:
                    matching_categories = [cat for cat in vision_categories if query_lower in cat.lower()]
                    if matching_categories:
                        match_found = True
                        match_details.append(f"Categories: {', '.join(matching_categories)}")

                if analysis_type in ['', 'all'] and enhanced_search_text:
                    if query_lower in enhanced_search_text.lower():
                        match_found = True
                        match_details.append(f"Enhanced Search: {enhanced_search_text}")

                if not match_found:
                    continue

            elif not query_lower and not has_any_vision_analysis:
                # If no query, skip items without vision analysis
                continue

            # Build detailed result with full vision analysis data
            result = {
                "id": media_data.get('id'),
                "title": media_data.get('title', 'Untitled'),
                "description": media_data.get('description', ''),
                "type": media_data.get('type', 'image'),
                "source": media_data.get('source', 'upload'),
                "url": media_data.get('url', ''),
                "thumbnail_url": media_data.get('thumbnailUrl', media_data.get('url', '')),
                "tags": media_data.get('tags', []),
                
                # Detailed vision analysis data
                "vision_analysis": {
                    "description": media_data.get('visionDescription', ''),
                    "keywords": media_data.get('visionKeywords', []),
                    "categories": media_data.get('visionCategories', []),
                    "enhanced_search_text": media_data.get('enhancedSearchText', ''),
                    "analysis_status": {
                        "has_description": has_vision_description,
                        "has_keywords": has_vision_keywords,
                        "has_categories": has_vision_categories,
                        "has_enhanced_search": has_enhanced_search_text,
                        "is_analyzed": has_any_vision_analysis
                    }
                },
                
                # Match details if query was provided
                "match_details": match_details if query_lower else None,
                "created_at": media_data.get('createdAt', ''),
                "created_by": media_data.get('createdBy', ''),
            }
            
            results.append(result)

        search_time_ms = (time.time() - start_time) * 1000

        # Build comprehensive response text
        if results:
            if query:
                summary_text = f"Found {len(results)} media items with vision analysis matching '{query}'"
            else:
                summary_text = f"Found {len(results)} media items with vision analysis data"
            
            summary_text += f" (out of {vision_analyzed_count} analyzed items from {total_media_count} total)"

            # Add detailed vision analysis summary
            vision_summary = "\n\nVision Analysis Summary:"
            for result in results[:3]:  # Show details for first 3 results
                va = result['vision_analysis']
                vision_summary += f"\n\n📷 {result['title']} ({result['id']}):"
                if va['description']:
                    vision_summary += f"\n   🔍 Description: {va['description']}"
                if va['keywords']:
                    vision_summary += f"\n   🏷️ Keywords: {', '.join(va['keywords'])}"
                if va['categories']:
                    vision_summary += f"\n   📂 Categories: {', '.join(va['categories'])}"

            return {
                "status": "success",
                "results": results,
                "total_count": len(results),
                "vision_analyzed_count": vision_analyzed_count,
                "total_media_count": total_media_count,
                "search_time_ms": search_time_ms,
                "query": query,
                "analysis_type": analysis_type or "all",
                "content": summary_text + vision_summary,
                "message": summary_text
            }
        else:
            if query:
                no_results_text = f"No media with vision analysis found matching '{query}'"
            else:
                no_results_text = f"No media with vision analysis found"
            
            no_results_text += f" (checked {vision_analyzed_count} analyzed items from {total_media_count} total)"

            return {
                "status": "success",
                "results": [],
                "total_count": 0,
                "vision_analyzed_count": vision_analyzed_count,
                "total_media_count": total_media_count,
                "search_time_ms": search_time_ms,
                "query": query,
                "analysis_type": analysis_type or "all",
                "content": no_results_text,
                "message": no_results_text
            }

    except Exception as e:
        logger.error(f"Vision analysis search failed: {e}")
        error_text = f"Error searching vision analysis data: {str(e)}"
        return {
            "status": "error",
            "error": str(e),
            "content": error_text,
            "message": error_text,
            "results": [],
            "total_count": 0
        }


def get_vision_analysis_details(
    media_id: str,
    brand_id: str = "",
) -> Dict[str, Any]:
    """
    Get comprehensive vision analysis details for a specific media item.

    Use this tool to retrieve complete vision analysis information for a specific
    media item, including analysis status, indexing details, and all AI-generated content.

    Examples of when to use this tool:
    - "Show me the vision analysis for media item xyz123"
    - "What AI analysis data do we have for this image?"
    - "Get the complete vision details for this media"
    - "Check the indexing status of this media item"

    Args:
        media_id (str): The ID of the media item to get vision analysis for.
        brand_id (str): Brand ID for scoped access. If empty, uses current context.

    Returns:
        dict: Contains detailed vision analysis data for the specific media item.
    """
    try:
        import firebase_admin
        from firebase_admin import firestore

        # Get brand ID from parameter or context
        effective_brand_id = brand_id or get_brand_context()

        if not effective_brand_id:
            error_text = "Brand ID required for vision analysis access. Please ensure user is authenticated."
            return {
                "status": "error",
                "error": error_text,
                "content": error_text
            }

        if not media_id:
            error_text = "Media ID is required to get vision analysis details."
            return {
                "status": "error",
                "error": error_text,
                "content": error_text
            }

        # Get Firestore client
        try:
            db = firestore.client()
        except ValueError:
            firebase_admin.initialize_app()
            db = firestore.client()

        start_time = time.time()

        # Get the specific media item
        doc_ref = db.collection('unifiedMedia').document(media_id)
        doc = doc_ref.get()

        if not doc.exists:
            error_text = f"Media item '{media_id}' not found."
            return {
                "status": "error",
                "error": error_text,
                "content": error_text
            }

        media_data = doc.to_dict()
        
        # Verify brand access
        if media_data.get('brandId') != effective_brand_id:
            error_text = f"Access denied to media item '{media_id}'. Brand mismatch."
            return {
                "status": "error",
                "error": error_text,
                "content": error_text
            }

        # Extract all vision analysis data
        vision_description = media_data.get('visionDescription', '')
        vision_keywords = media_data.get('visionKeywords', [])
        vision_categories = media_data.get('visionCategories', [])
        enhanced_search_text = media_data.get('enhancedSearchText', '')

        # Analysis status
        has_vision_description = bool(vision_description)
        has_vision_keywords = bool(vision_keywords)
        has_vision_categories = bool(vision_categories)
        has_enhanced_search_text = bool(enhanced_search_text)
        has_any_vision_analysis = (
            has_vision_description or has_vision_keywords or 
            has_vision_categories or has_enhanced_search_text
        )

        # Build comprehensive response
        result = {
            "media_id": media_id,
            "brand_id": effective_brand_id,
            "basic_info": {
                "title": media_data.get('title', 'Untitled'),
                "description": media_data.get('description', ''),
                "type": media_data.get('type', 'image'),
                "source": media_data.get('source', 'upload'),
                "url": media_data.get('url', ''),
                "thumbnail_url": media_data.get('thumbnailUrl', media_data.get('url', '')),
                "tags": media_data.get('tags', []),
                "created_at": media_data.get('createdAt', ''),
                "created_by": media_data.get('createdBy', ''),
            },
            "vision_analysis": {
                "description": vision_description,
                "keywords": vision_keywords,
                "keywords_count": len(vision_keywords),
                "categories": vision_categories,
                "categories_count": len(vision_categories),
                "enhanced_search_text": enhanced_search_text,
                "analysis_status": {
                    "has_description": has_vision_description,
                    "has_keywords": has_vision_keywords,
                    "has_categories": has_vision_categories,
                    "has_enhanced_search": has_enhanced_search_text,
                    "is_fully_analyzed": has_any_vision_analysis,
                    "analysis_completeness": sum([
                        has_vision_description, has_vision_keywords,
                        has_vision_categories, has_enhanced_search_text
                    ]) / 4 * 100  # Percentage complete
                }
            },
            "search_integration": {
                "searchable_fields": [],
                "indexed_content_preview": ""
            }
        }

        # Build searchable fields list
        searchable_fields = []
        indexed_content_parts = []

        if has_vision_description:
            searchable_fields.append("Vision Description")
            indexed_content_parts.append(f"Description: {vision_description}")

        if has_vision_keywords:
            searchable_fields.append("Vision Keywords")
            indexed_content_parts.append(f"Keywords: {', '.join(vision_keywords)}")

        if has_vision_categories:
            searchable_fields.append("Vision Categories")
            indexed_content_parts.append(f"Categories: {', '.join(vision_categories)}")

        if has_enhanced_search_text:
            searchable_fields.append("Enhanced Search Text")
            indexed_content_parts.append(f"Enhanced: {enhanced_search_text}")

        result["search_integration"]["searchable_fields"] = searchable_fields
        result["search_integration"]["indexed_content_preview"] = "\n".join(indexed_content_parts)

        search_time_ms = (time.time() - start_time) * 1000

        # Build response text
        if has_any_vision_analysis:
            content_text = f"📷 Vision Analysis Details for '{media_data.get('title', media_id)}'\n\n"
            
            if has_vision_description:
                content_text += f"🔍 AI Description:\n{vision_description}\n\n"
            
            if has_vision_keywords:
                content_text += f"🏷️ AI Keywords ({len(vision_keywords)}):\n{', '.join(vision_keywords)}\n\n"
            
            if has_vision_categories:
                content_text += f"📂 AI Categories ({len(vision_categories)}):\n{', '.join(vision_categories)}\n\n"
            
            if has_enhanced_search_text:
                content_text += f"🔎 Enhanced Search Text:\n{enhanced_search_text}\n\n"
            
            content_text += f"✅ Analysis Status: {result['vision_analysis']['analysis_status']['analysis_completeness']:.0f}% complete\n"
            content_text += f"🔍 Searchable via: {', '.join(searchable_fields)}"

        else:
            content_text = f"❌ No vision analysis data found for media item '{media_data.get('title', media_id)}'\n\n"
            content_text += "💡 This media item hasn't been processed with AI vision analysis yet. "
            content_text += "Run vision analysis to enable enhanced search capabilities."

        return {
            "status": "success",
            "result": result,
            "search_time_ms": search_time_ms,
            "content": content_text,
            "message": f"Retrieved vision analysis details for {media_id}"
        }

    except Exception as e:
        logger.error(f"Get vision analysis details failed: {e}")
        error_text = f"Error retrieving vision analysis details: {str(e)}"
        return {
            "status": "error",
            "error": str(e),
            "content": error_text,
            "message": error_text
        }


def get_vision_analysis_stats(
    brand_id: str = "",
) -> Dict[str, Any]:
    """
    Get comprehensive statistics about vision analysis coverage for a brand's media.

    Use this tool to understand the current state of vision analysis across
    the brand's media library, including coverage statistics and analysis quality.

    Examples of when to use this tool:
    - "How much of our media has been analyzed with AI vision?"
    - "Show me vision analysis statistics for our brand"
    - "What's the coverage of AI analysis across our media library?"
    - "Get a summary of vision analysis status"

    Args:
        brand_id (str): Brand ID for scoped stats. If empty, uses current context.

    Returns:
        dict: Contains comprehensive statistics about vision analysis coverage.
    """
    try:
        import firebase_admin
        from firebase_admin import firestore

        # Get brand ID from parameter or context
        effective_brand_id = brand_id or get_brand_context()

        if not effective_brand_id:
            error_text = "Brand ID required for vision analysis stats. Please ensure user is authenticated."
            return {
                "status": "error",
                "error": error_text,
                "content": error_text
            }

        # Get Firestore client
        try:
            db = firestore.client()
        except ValueError:
            firebase_admin.initialize_app()
            db = firestore.client()

        start_time = time.time()

        # Query all media for the brand
        collection_ref = db.collection('unifiedMedia')
        docs = collection_ref.where('brandId', '==', effective_brand_id).stream()

        # Initialize counters
        total_media = 0
        analyzed_media = 0
        by_type = {"image": 0, "video": 0, "other": 0}
        analyzed_by_type = {"image": 0, "video": 0, "other": 0}
        
        analysis_components = {
            "description": 0,
            "keywords": 0,
            "categories": 0,
            "enhanced_search": 0
        }
        
        recent_analyzed = []  # Last 10 analyzed items
        coverage_by_source = {}

        for doc in docs:
            total_media += 1
            media_data = doc.to_dict()
            media_type = media_data.get('type', 'other')
            media_source = media_data.get('source', 'unknown')
            
            # Count by type
            by_type[media_type] = by_type.get(media_type, 0) + 1
            
            # Count by source
            if media_source not in coverage_by_source:
                coverage_by_source[media_source] = {"total": 0, "analyzed": 0}
            coverage_by_source[media_source]["total"] += 1

            # Check vision analysis components
            has_description = bool(media_data.get('visionDescription'))
            has_keywords = bool(media_data.get('visionKeywords'))
            has_categories = bool(media_data.get('visionCategories'))
            has_enhanced_search = bool(media_data.get('enhancedSearchText'))

            has_any_analysis = (has_description or has_keywords or has_categories or has_enhanced_search)

            if has_any_analysis:
                analyzed_media += 1
                analyzed_by_type[media_type] = analyzed_by_type.get(media_type, 0) + 1
                coverage_by_source[media_source]["analyzed"] += 1

                # Count individual components
                if has_description:
                    analysis_components["description"] += 1
                if has_keywords:
                    analysis_components["keywords"] += 1
                if has_categories:
                    analysis_components["categories"] += 1
                if has_enhanced_search:
                    analysis_components["enhanced_search"] += 1

                # Add to recent analyzed (with creation date)
                recent_analyzed.append({
                    "id": doc.id,
                    "title": media_data.get('title', 'Untitled'),
                    "type": media_type,
                    "created_at": media_data.get('createdAt', ''),
                    "analysis_components": {
                        "description": has_description,
                        "keywords": has_keywords,
                        "categories": has_categories,
                        "enhanced_search": has_enhanced_search
                    }
                })

        # Sort recent analyzed by creation date and take last 10
        recent_analyzed.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        recent_analyzed = recent_analyzed[:10]

        search_time_ms = (time.time() - start_time) * 1000

        # Calculate percentages
        overall_coverage = (analyzed_media / total_media * 100) if total_media > 0 else 0
        
        type_coverage = {}
        for media_type, total in by_type.items():
            if total > 0:
                analyzed_count = analyzed_by_type.get(media_type, 0)
                type_coverage[media_type] = {
                    "total": total,
                    "analyzed": analyzed_count,
                    "coverage_percentage": (analyzed_count / total * 100)
                }

        source_coverage = {}
        for source, counts in coverage_by_source.items():
            if counts["total"] > 0:
                source_coverage[source] = {
                    **counts,
                    "coverage_percentage": (counts["analyzed"] / counts["total"] * 100)
                }

        # Build comprehensive stats
        stats = {
            "brand_id": effective_brand_id,
            "overview": {
                "total_media_items": total_media,
                "vision_analyzed_items": analyzed_media,
                "unanalyzed_items": total_media - analyzed_media,
                "overall_coverage_percentage": overall_coverage
            },
            "by_media_type": type_coverage,
            "by_source": source_coverage,
            "analysis_components": {
                "descriptions_generated": analysis_components["description"],
                "keywords_extracted": analysis_components["keywords"],
                "categories_assigned": analysis_components["categories"],
                "enhanced_search_created": analysis_components["enhanced_search"]
            },
            "recent_analyzed": recent_analyzed,
            "recommendations": []
        }

        # Generate recommendations
        if overall_coverage < 50:
            stats["recommendations"].append(
                "Consider running vision analysis on more media items to improve search accuracy"
            )
        
        if total_media - analyzed_media > 10:
            stats["recommendations"].append(
                f"There are {total_media - analyzed_media} unanalyzed media items that could benefit from vision analysis"
            )

        # Build response text
        content_text = f"📊 Vision Analysis Statistics for Brand {effective_brand_id}\n\n"
        content_text += f"🔍 Overall Coverage: {analyzed_media}/{total_media} items ({overall_coverage:.1f}%)\n\n"
        
        content_text += "📈 Coverage by Media Type:\n"
        for media_type, coverage in type_coverage.items():
            content_text += f"  • {media_type.title()}: {coverage['analyzed']}/{coverage['total']} ({coverage['coverage_percentage']:.1f}%)\n"
        
        content_text += f"\n🔬 Analysis Components Generated:\n"
        content_text += f"  • Descriptions: {analysis_components['description']}\n"
        content_text += f"  • Keywords: {analysis_components['keywords']}\n"
        content_text += f"  • Categories: {analysis_components['categories']}\n"
        content_text += f"  • Enhanced Search: {analysis_components['enhanced_search']}\n"

        if stats["recommendations"]:
            content_text += f"\n💡 Recommendations:\n"
            for rec in stats["recommendations"]:
                content_text += f"  • {rec}\n"

        return {
            "status": "success",
            "stats": stats,
            "search_time_ms": search_time_ms,
            "content": content_text,
            "message": f"Vision analysis stats: {overall_coverage:.1f}% coverage ({analyzed_media}/{total_media} items)"
        }

    except Exception as e:
        logger.error(f"Get vision analysis stats failed: {e}")
        error_text = f"Error retrieving vision analysis statistics: {str(e)}"
        return {
            "status": "error",
            "error": str(e),
            "content": error_text,
            "message": error_text
        }