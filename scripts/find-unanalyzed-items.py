#!/usr/bin/env python3
"""
Find and analyze the remaining 2 unanalyzed media items to achieve 100% coverage
"""

import sys
import os
sys.path.append('python_service')

import firebase_admin
from firebase_admin import firestore
from python_service.services.vision_analysis_service import get_vision_analysis_service
import asyncio

try:
    db = firestore.client()
except ValueError:
    firebase_admin.initialize_app()
    db = firestore.client()

brand_id = 'brand_1765141979741_432aq4'

async def find_and_analyze_missing_items():
    # Fetch all media items
    docs = db.collection('unifiedMedia').where('brandId', '==', brand_id).stream()
    media_items = []
    for doc in docs:
        media_data = doc.to_dict()
        media_data['id'] = doc.id
        media_items.append(media_data)

    print(f"🔍 Found {len(media_items)} total media items")

    # Find unanalyzed items
    unanalyzed_items = []
    for item in media_items:
        if item.get('type') in ['image', 'video'] and not item.get('visionDescription'):
            unanalyzed_items.append(item)

    print(f"📊 Analysis Status:")
    print(f"  Total media: {len(media_items)}")
    
    # Count by type
    type_counts = {}
    analyzed_by_type = {}
    for item in media_items:
        item_type = item.get('type', 'unknown')
        has_analysis = bool(item.get('visionDescription'))
        
        if item_type not in type_counts:
            type_counts[item_type] = 0
            analyzed_by_type[item_type] = 0
            
        type_counts[item_type] += 1
        if has_analysis:
            analyzed_by_type[item_type] += 1

    for media_type, total in type_counts.items():
        analyzed = analyzed_by_type.get(media_type, 0)
        print(f"  {media_type}: {analyzed}/{total} analyzed ({analyzed/total*100:.1f}%)")

    if not unanalyzed_items:
        print("🎉 All media items are already analyzed! 100% complete!")
        return

    print(f"\n🎯 Found {len(unanalyzed_items)} unanalyzed items:")
    for i, item in enumerate(unanalyzed_items):
        print(f"  {i+1}. Type: {item.get('type')}, ID: {item.get('id')}")
        print(f"     Source: {item.get('source', 'unknown')}")
        print(f"     URL: {(item.get('url') or item.get('videoUrl') or 'no-url')[:80]}...")
        
    # Analyze the unanalyzed items
    print(f"\n🚀 Starting analysis of {len(unanalyzed_items)} items...")
    
    vision_service = get_vision_analysis_service()
    
    for i, item in enumerate(unanalyzed_items):
        print(f"\n📝 Analyzing item {i+1}/{len(unanalyzed_items)}: {item.get('id')}")
        try:
            result = await vision_service.analyze_media_item(item)
            
            if result.get('visionDescription'):
                print(f"   ✅ SUCCESS: {result['visionDescription'][:100]}...")
                
                # Update Firestore
                doc_ref = db.collection('unifiedMedia').document(item['id'])
                update_data = {}
                if result.get('visionDescription'):
                    update_data['visionDescription'] = result['visionDescription']
                if result.get('visionKeywords'):
                    update_data['visionKeywords'] = result['visionKeywords']
                if result.get('visionCategories'):
                    update_data['visionCategories'] = result['visionCategories']
                if result.get('enhancedSearchText'):
                    update_data['enhancedSearchText'] = result['enhancedSearchText']
                
                if update_data:
                    doc_ref.update(update_data)
                    print(f"   💾 Updated Firestore")
            else:
                print(f"   ❌ FAILED: {result.get('_vision_error', 'Unknown error')}")
                
        except Exception as e:
            print(f"   💥 EXCEPTION: {e}")
    
    # Final check
    print(f"\n📊 Final verification...")
    docs = db.collection('unifiedMedia').where('brandId', '==', brand_id).stream()
    final_items = []
    for doc in docs:
        media_data = doc.to_dict()
        media_data['id'] = doc.id
        final_items.append(media_data)

    final_analyzed = 0
    final_analyzable = 0
    for item in final_items:
        if item.get('type') in ['image', 'video']:
            final_analyzable += 1
            if item.get('visionDescription'):
                final_analyzed += 1

    success_rate = (final_analyzed / final_analyzable * 100) if final_analyzable > 0 else 0
    print(f"🎯 Final Result: {final_analyzed}/{final_analyzable} analyzed ({success_rate:.1f}%)")
    
    if success_rate == 100.0:
        print("🎉🎉🎉 ACHIEVEMENT UNLOCKED: 100% VISION ANALYSIS COVERAGE! 🎉🎉🎉")
    else:
        print(f"📈 Still need to analyze {final_analyzable - final_analyzed} more items")

# Run the analysis
asyncio.run(find_and_analyze_missing_items())