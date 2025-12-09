#!/usr/bin/env python3
"""
Check what vision analysis data is actually stored for videos in Firestore
"""
import sys
import os
sys.path.append('python_service')

import firebase_admin
from firebase_admin import firestore

try:
    db = firestore.client()
except ValueError:
    firebase_admin.initialize_app()
    db = firestore.client()

brand_id = 'brand_1765141979741_432aq4'

def check_video_data():
    # Get all videos
    docs = db.collection('unifiedMedia').where('brandId', '==', brand_id).where('type', '==', 'video').stream()
    
    videos = []
    for doc in docs:
        media_data = doc.to_dict()
        media_data['id'] = doc.id
        videos.append(media_data)
    
    print(f"Found {len(videos)} videos")
    
    for i, video in enumerate(videos):
        print(f"\n📹 Video {i+1}: {video['id']}")
        print(f"   Source: {video.get('source', 'unknown')}")
        print(f"   Title: {video.get('title', 'no-title')[:50]}")
        
        # Check vision analysis fields
        has_vision_desc = bool(video.get('visionDescription'))
        has_vision_keywords = bool(video.get('visionKeywords'))
        has_vision_categories = bool(video.get('visionCategories'))
        
        print(f"   Has visionDescription: {has_vision_desc}")
        if has_vision_desc:
            print(f"   Description: {video['visionDescription'][:100]}...")
            
        print(f"   Has visionKeywords: {has_vision_keywords}")
        if has_vision_keywords and isinstance(video.get('visionKeywords'), list):
            print(f"   Keywords ({len(video['visionKeywords'])}): {video['visionKeywords'][:5]}...")
            
        print(f"   Has visionCategories: {has_vision_categories}")
        if has_vision_categories and isinstance(video.get('visionCategories'), list):
            print(f"   Categories: {video['visionCategories']}")
        
        # Check all keys that contain 'vision'
        vision_keys = [k for k in video.keys() if 'vision' in k.lower()]
        print(f"   All vision-related fields: {vision_keys}")

check_video_data()