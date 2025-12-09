#!/usr/bin/env python3
"""
Script to identify unanalyzed images and attempt manual analysis
"""

import os
import sys
import logging
import asyncio
import time

# Add the python_service directory to the path
sys.path.append('/Users/huguensjean/MOMENTUM_SOURCE/momentum-agent/python_service')

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    from services.vision_analysis_service import get_vision_analysis_service
    
    # Initialize Firebase Admin
    os.environ['MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON'] = open('/Users/huguensjean/MOMENTUM_SOURCE/momentum-agent/.env', 'r').read().split('MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON=')[1].split('\n')[0]
    
    # Initialize Firebase
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app()
    
    db = firestore.client()
    
    async def find_and_analyze_unanalyzed_images():
        brand_id = 'brand_1765141979741_432aq4'
        
        print(f"🔍 Finding unanalyzed images for brand: {brand_id}")
        
        # Fetch all media items
        docs = db.collection('unifiedMedia').where('brandId', '==', brand_id).stream()
        all_items = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            all_items.append(data)
        
        # Filter to images
        all_images = [item for item in all_items if item.get('type') == 'image']
        analyzed_images = [item for item in all_images if item.get('visionDescription')]
        unanalyzed_images = [item for item in all_images if not item.get('visionDescription')]
        
        print(f"📊 Statistics:")
        print(f"  Total images: {len(all_images)}")
        print(f"  Analyzed: {len(analyzed_images)}")
        print(f"  Unanalyzed: {len(unanalyzed_images)}")
        
        if not unanalyzed_images:
            print("✅ All images are already analyzed!")
            return
        
        print(f"\n🔍 Analyzing {len(unanalyzed_images)} unanalyzed images:")
        
        # Check each unanalyzed image
        for i, item in enumerate(unanalyzed_images):
            print(f"\n{i+1}. Image ID: {item.get('id', 'NO_ID')}")
            print(f"   Source: {item.get('source', 'NO_SOURCE')}")
            print(f"   URL: {item.get('url', 'NO_URL')}")
            print(f"   Thumbnail URL: {item.get('thumbnailUrl', 'NO_THUMBNAIL')}")
            print(f"   Title: {item.get('title', 'NO_TITLE')}")
            
            # Check if it has any valid URL
            image_url = item.get('url') or item.get('thumbnailUrl') or item.get('sourceImageUrl') or item.get('generatedImageUrl')
            
            if not image_url:
                print(f"   ❌ ISSUE: No valid image URL found")
                continue
            
            print(f"   🔗 Using URL: {image_url[:100]}...")
            
            # Try to analyze this specific image
            try:
                vision_service = get_vision_analysis_service()
                result = await vision_service.analyze_media_item(item)
                
                if result.get('visionDescription'):
                    print(f"   ✅ SUCCESS: Analysis completed")
                    print(f"   📝 Description: {result['visionDescription'][:100]}...")
                    
                    # Update Firestore
                    try:
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
                            print(f"   💾 Updated Firestore with vision data")
                        
                    except Exception as update_error:
                        print(f"   ❌ Firestore update failed: {update_error}")
                
                elif result.get('_vision_error'):
                    print(f"   ❌ ANALYSIS ERROR: {result['_vision_error']}")
                else:
                    print(f"   ❓ UNKNOWN: No vision data or error returned")
                    
            except Exception as e:
                print(f"   💥 EXCEPTION: {e}")
            
            # Small delay between analyses
            await asyncio.sleep(1)
        
        print(f"\n🎯 Manual analysis complete!")
        
        # Check final statistics
        print(f"\n📊 Final check...")
        docs = db.collection('unifiedMedia').where('brandId', '==', brand_id).stream()
        final_items = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            final_items.append(data)
        
        final_images = [item for item in final_items if item.get('type') == 'image']
        final_analyzed = [item for item in final_images if item.get('visionDescription')]
        final_success_rate = (len(final_analyzed) / len(final_images)) * 100 if final_images else 0
        
        print(f"📈 Final Results:")
        print(f"  Total images: {len(final_images)}")
        print(f"  Analyzed: {len(final_analyzed)}")
        print(f"  Success rate: {final_success_rate:.1f}%")
        
        if final_success_rate == 100.0:
            print(f"🎉 SUCCESS: Achieved 100% vision analysis!")
        else:
            print(f"🎯 Still need to analyze {len(final_images) - len(final_analyzed)} more images")
    
    # Run the analysis
    asyncio.run(find_and_analyze_unanalyzed_images())
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()