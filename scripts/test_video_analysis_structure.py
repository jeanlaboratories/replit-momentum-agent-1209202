#!/usr/bin/env python3
"""
Test script to verify video analysis now returns structured data
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

async def test_video_analysis():
    # Get one analyzed video to test re-analysis
    docs = db.collection('unifiedMedia').where('brandId', '==', brand_id).where('type', '==', 'video').limit(1).stream()
    
    video_item = None
    for doc in docs:
        media_data = doc.to_dict()
        media_data['id'] = doc.id
        video_item = media_data
        break
    
    if not video_item:
        print("No video found to test")
        return
    
    print(f"Testing video analysis on: {video_item['id']}")
    print(f"Video URL: {video_item.get('url', 'no-url')[:80]}...")
    
    vision_service = get_vision_analysis_service()
    result = await vision_service.analyze_media_item(video_item)
    
    print(f"\nAnalysis Result Keys: {list(result.keys())}")
    
    if result.get('visionDescription'):
        print(f"\n✅ DESCRIPTION: {result['visionDescription'][:150]}...")
    else:
        print(f"\n❌ NO DESCRIPTION")
        
    if result.get('visionKeywords'):
        print(f"\n✅ KEYWORDS ({len(result['visionKeywords'])}): {result['visionKeywords'][:10]}...")
    else:
        print(f"\n❌ NO KEYWORDS")
        
    if result.get('visionCategories'):
        print(f"\n✅ CATEGORIES: {result['visionCategories']}")
    else:
        print(f"\n❌ NO CATEGORIES")
        
    if result.get('enhancedSearchText'):
        print(f"\n✅ ENHANCED SEARCH TEXT: {result['enhancedSearchText'][:100]}...")
    else:
        print(f"\n❌ NO ENHANCED SEARCH TEXT")
        
    print(f"\nRAW ANALYSIS: {result.get('analysis', 'none')[:200]}...")

# Run the test
asyncio.run(test_video_analysis())