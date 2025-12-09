import logging
import asyncio
import time
from typing import Dict, List, Any, Optional
from momentum_agent import analyze_image, process_youtube_video

logger = logging.getLogger(__name__)

class VisionAnalysisService:
    """
    Service for analyzing images and generating detailed descriptions and search terms
    to enhance Firestore search capabilities.
    """
    
    def __init__(self):
        self.analysis_prompt = """Analyze this image in detail and provide:

1. DETAILED DESCRIPTION: A comprehensive description of what you see (objects, people, activities, setting, mood, style, etc.)

2. SEARCH KEYWORDS: Generate 15-20 relevant keywords that someone might use to search for this image, including:
   - Objects and items visible
   - Colors and visual elements  
   - Activities or actions
   - Emotions or mood
   - Style or aesthetic
   - Setting or location type
   - People or characters (if any)
   - Art style or technique (if applicable)

3. CATEGORIES: Classify this image into relevant categories (e.g., portrait, landscape, product, abstract, etc.)

Format your response as:

DESCRIPTION: [detailed description here]

KEYWORDS: [comma-separated list of keywords]

CATEGORIES: [comma-separated list of categories]"""

        # Video analysis prompt
        self.video_analysis_prompt = """Analyze this video in detail and provide:

1. DETAILED DESCRIPTION: A comprehensive description of what happens in the video (content, activities, scenes, people, objects, mood, style, etc.)

2. SEARCH KEYWORDS: Generate 15-20 relevant keywords that someone might use to search for this video, including:
   - Main topics and themes
   - Activities or actions shown
   - People, objects, or locations
   - Emotions or mood
   - Style or production quality
   - Content type (tutorial, entertainment, documentary, etc.)
   - Key concepts or subjects covered

3. CATEGORIES: Classify this video into relevant categories (e.g., tutorial, entertainment, educational, promotional, etc.)

Format your response as:

DESCRIPTION: [detailed description here]

KEYWORDS: [comma-separated list of keywords]

CATEGORIES: [comma-separated list of categories]"""

    async def analyze_media_item(self, media_item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a media item and return enhanced metadata with vision analysis.
        
        Args:
            media_item: Dictionary containing media metadata including url, type, etc.
            
        Returns:
            Dictionary with additional fields: visionDescription, visionKeywords, visionCategories
        """
        start_time = time.time()
        media_id = media_item.get('id', 'unknown')
        media_source = media_item.get('source', 'unknown')
        
        try:
            # Handle both images and videos
            media_type = media_item.get('type')
            if media_type not in ['image', 'video']:
                logger.debug(f"Skipping non-media item: {media_id} (type: {media_type})")
                return media_item
            
            # Skip if already analyzed (has visionDescription)
            if media_item.get('visionDescription'):
                logger.debug(f"Skipping already analyzed media item: {media_id}")
                return media_item
            
            # Check for URL in multiple possible fields based on media type
            media_url = None
            if media_type == 'image':
                media_url = (
                    media_item.get('url') or 
                    media_item.get('thumbnailUrl') or 
                    media_item.get('sourceImageUrl') or 
                    media_item.get('generatedImageUrl')
                )
            elif media_type == 'video':
                media_url = (
                    media_item.get('url') or
                    media_item.get('videoUrl') or 
                    media_item.get('sourceVideoUrl') or 
                    media_item.get('generatedVideoUrl') or
                    media_item.get('youtubeUrl')
                )
            
            if not media_url:
                logger.warning(f"No {media_type} URL found for media item {media_id} (source: {media_source}). Available fields: {list(media_item.keys())}")
                return media_item
            
            # Special handling for different URL types
            if media_type == 'image' and not self._is_valid_image_url(media_url):
                logger.warning(f"Invalid or inaccessible image URL for {media_id} (source: {media_source}): {media_url[:100]}...")
                return media_item
            elif media_type == 'video' and not self._is_valid_video_url(media_url):
                logger.warning(f"Invalid or inaccessible video URL for {media_id} (source: {media_source}): {media_url[:100]}...")
                return media_item
            
            logger.info(f"Analyzing {media_type}: {media_id} (source: {media_source}) - {media_url[:100]}...")
            
            # Use the appropriate analysis function based on media type
            analysis_start = time.time()
            result = None
            max_retries = 3
            retry_delays = [1, 3, 5]  # Progressive delays in seconds
            
            for attempt in range(max_retries):
                try:
                    if attempt > 0:
                        logger.info(f"Retrying analysis for {media_id} (attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(retry_delays[min(attempt - 1, len(retry_delays) - 1)])
                    
                    if media_type == 'image':
                        result = analyze_image(
                            prompt=self.analysis_prompt,
                            image_url=media_url
                        )
                    elif media_type == 'video':
                        result = await self._analyze_video(media_url, media_item)
                    
                    # If successful, break out of retry loop
                    if result.get('status') == 'success':
                        break
                    else:
                        logger.warning(f"Analysis attempt {attempt + 1} failed for {media_id}: {result.get('error', 'Unknown error')}")
                        
                except Exception as e:
                    logger.warning(f"Analysis attempt {attempt + 1} threw exception for {media_id}: {e}")
                    if attempt == max_retries - 1:
                        # Re-raise on final attempt
                        raise
                    
            analysis_duration = time.time() - analysis_start
            
            if result.get('status') == 'success':
                analysis_text = result.get('analysis', '')
                
                if not analysis_text or len(analysis_text.strip()) < 10:
                    logger.warning(f"Empty or very short analysis response for {media_id}: '{analysis_text}'")
                    return media_item
                
                # Parse the structured response
                vision_data = self._parse_analysis(analysis_text)
                
                # Validate parsed data
                if not any([vision_data.get('visionDescription'), vision_data.get('visionKeywords'), vision_data.get('visionCategories')]):
                    logger.warning(f"No useful vision data extracted for {media_id} from response: '{analysis_text[:200]}...'")
                    return media_item
                
                # Add vision data to the media item
                enhanced_item = media_item.copy()
                enhanced_item.update(vision_data)
                
                total_duration = time.time() - start_time
                logger.info(f"Successfully analyzed image {media_id} (source: {media_source}) - Description: {len(vision_data.get('visionDescription', ''))} chars, Keywords: {len(vision_data.get('visionKeywords', []))}, Categories: {len(vision_data.get('visionCategories', []))} (analysis: {analysis_duration:.2f}s, total: {total_duration:.2f}s)")
                return enhanced_item
            else:
                error_msg = result.get('error', 'Unknown error')
                logger.error(f"Vision analysis failed for {media_id} (source: {media_source}): {error_msg} (duration: {analysis_duration:.2f}s)")
                
                # Special handling for inaccessible external images (like iStock)
                if "403" in error_msg and "istockphoto.com" in media_url and media_type == 'image':
                    logger.info(f"Providing fallback analysis for protected iStock image: {media_id}")
                    return self._provide_fallback_analysis_for_istock(media_item)
                
                # Store error info for debugging
                enhanced_item = media_item.copy()
                enhanced_item['_vision_error'] = error_msg
                return enhanced_item
                
        except Exception as e:
            total_duration = time.time() - start_time
            logger.error(f"Error analyzing media item {media_id} (source: {media_source}): {e} (duration: {total_duration:.2f}s)")
            
            # Special handling for inaccessible external images (like iStock)
            if "403" in str(e) and "istockphoto.com" in media_url and media_type == 'image':
                logger.info(f"Providing fallback analysis for protected iStock image: {media_id}")
                return self._provide_fallback_analysis_for_istock(media_item)
            
            # Store error info for debugging
            enhanced_item = media_item.copy()
            enhanced_item['_vision_error'] = str(e)
            import traceback
            logger.error(f"Full traceback for {media_id}: {traceback.format_exc()}")
            return enhanced_item
    
    async def _analyze_video(self, video_url: str, media_item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze video using appropriate method based on video source.
        """
        try:
            source = media_item.get('source', '')
            
            # For YouTube videos, use the existing process_youtube_video function
            if 'youtube' in video_url.lower() or source == 'youtube':
                logger.info(f"Analyzing YouTube video: {video_url}")
                result = process_youtube_video(video_url, self.video_analysis_prompt)
                
                if result.get('analysis'):
                    # Parse the structured response like image analysis
                    vision_data = self._parse_analysis(result['analysis'])
                    
                    return {
                        'status': 'success',
                        'analysis': result['analysis'],
                        'model': result.get('model', 'youtube-analysis'),
                        'visionDescription': vision_data.get('visionDescription', ''),
                        'visionKeywords': vision_data.get('visionKeywords', []),
                        'visionCategories': vision_data.get('visionCategories', []),
                        'enhancedSearchText': vision_data.get('enhancedSearchText', '')
                    }
                elif result.get('error'):
                    return {
                        'status': 'error', 
                        'error': result['error']
                    }
                else:
                    return {
                        'status': 'error',
                        'error': 'No analysis returned from YouTube video processing'
                    }
            
            # For other video types (generated, uploaded), use the team intelligence approach
            else:
                logger.info(f"Analyzing video file: {video_url}")
                try:
                    # Use the same approach as analyze_image from media_tools
                    from momentum_agent import genai_client
                    from google.genai import types
                    from utils.storage_utils import download_from_firebase_storage, is_firebase_storage_url
                    import requests
                    
                    if not genai_client:
                        return {
                            'status': 'error',
                            'error': 'Gemini client not initialized'
                        }
                    
                    # Download the video first (similar to analyze_image)
                    if is_firebase_storage_url(video_url):
                        # Download from Firebase Storage
                        video_bytes, mime_type = download_from_firebase_storage(video_url)
                        if video_bytes is None:
                            return {
                                'status': 'error',
                                'error': 'Failed to download video from Firebase Storage'
                            }
                    else:
                        # Download from regular HTTP(S) URL
                        response = requests.get(video_url, timeout=60)
                        response.raise_for_status()
                        video_bytes = response.content
                        mime_type = 'video/mp4'  # Default video type
                    
                    # Upload to Gemini Files API using existing function
                    from utils.storage_utils import upload_file_to_gemini
                    upload_response = upload_file_to_gemini(video_bytes, mime_type or 'video/mp4')
                    
                    if not upload_response:
                        return {
                            'status': 'error',
                            '_vision_error': 'Failed to upload video to Gemini Files API'
                        }
                    
                    # Wait for file to be in ACTIVE state
                    import time
                    max_wait = 30  # Wait up to 30 seconds
                    wait_interval = 2  # Check every 2 seconds
                    
                    file_is_active = False
                    for attempt in range(max_wait // wait_interval):
                        try:
                            file_info = genai_client.files.get(name=upload_response.name)
                            state_str = str(getattr(file_info, 'state', 'unknown'))
                            logger.info(f"File {upload_response.name} state: {state_str}")
                            
                            if state_str == 'FileState.ACTIVE':
                                logger.info(f"File {upload_response.name} is now active!")
                                file_is_active = True
                                break
                            elif state_str in ['FileState.PROCESSING', 'FileState.UPLOADING']:
                                logger.info(f"File {upload_response.name} still processing, waiting...")
                                time.sleep(wait_interval)
                            else:
                                logger.warning(f"File {upload_response.name} in unexpected state: {state_str}")
                                time.sleep(wait_interval)
                        except Exception as e:
                            logger.warning(f"Error checking file state: {e}")
                            time.sleep(wait_interval)
                    
                    if not file_is_active:
                        # File still not active after waiting
                        try:
                            genai_client.files.delete(name=upload_response.name)
                        except:
                            pass
                        return {
                            'status': 'error',
                            '_vision_error': f'File {upload_response.name} did not become active within {max_wait} seconds'
                        }
                    
                    # Analyze using the uploaded file
                    try:
                        logger.info(f"Starting video analysis with file URI: {upload_response.uri}")
                        response = genai_client.models.generate_content(
                            model='gemini-2.0-flash-exp',
                            contents=types.Content(
                                parts=[
                                    types.Part(file_data=types.FileData(file_uri=upload_response.uri)),
                                    types.Part(text=self.video_analysis_prompt)
                                ]
                            )
                        )
                        logger.info(f"Video analysis completed successfully")
                    except Exception as analysis_error:
                        logger.error(f"Video analysis failed: {analysis_error}")
                        # Clean up uploaded file
                        try:
                            genai_client.files.delete(name=upload_response.name)
                        except:
                            pass
                        return {
                            'status': 'error',
                            '_vision_error': f'Video analysis failed: {str(analysis_error)}'
                        }
                    
                    # Clean up uploaded file
                    try:
                        genai_client.files.delete(name=upload_response.name)
                    except:
                        pass  # Non-critical if cleanup fails
                    
                    if response.text:
                        # Parse the structured response like image analysis
                        vision_data = self._parse_analysis(response.text)
                        
                        return {
                            'status': 'success',
                            'analysis': response.text,
                            'model': 'gemini-2.0-flash-exp',
                            'visionDescription': vision_data.get('visionDescription', ''),
                            'visionKeywords': vision_data.get('visionKeywords', []),
                            'visionCategories': vision_data.get('visionCategories', []),
                            'enhancedSearchText': vision_data.get('enhancedSearchText', '')
                        }
                    else:
                        return {
                            'status': 'error',
                            'error': 'No response text from Gemini video analysis'
                        }
                        
                except Exception as gemini_error:
                    logger.error(f"Gemini video analysis failed: {gemini_error}")
                    return {
                        'status': 'error',
                        'error': f'Gemini video analysis failed: {gemini_error}'
                    }
                    
        except Exception as e:
            logger.error(f"Video analysis error: {e}")
            return {
                'status': 'error',
                'error': f'Video analysis failed: {e}'
            }
    
    def _is_valid_video_url(self, video_url: str) -> bool:
        """
        Check if the video URL is valid and potentially accessible.
        """
        try:
            if not video_url or not isinstance(video_url, str):
                return False
            
            # Check for common invalid patterns
            if video_url.lower() in ['null', 'none', 'undefined', '']:
                return False
            
            # Must start with http/https or be a Firebase Storage URL or YouTube URL
            if not (video_url.startswith('http://') or 
                    video_url.startswith('https://') or
                    'firebasestorage.googleapis.com' in video_url or
                    'storage.googleapis.com' in video_url or
                    'youtube.com' in video_url or
                    'youtu.be' in video_url):
                return False
            
            # Check for suspicious patterns that might indicate broken URLs
            suspicious_patterns = [
                '[object Object]',
                'javascript:',
                'data:text/',
                'blob:',
            ]
            
            for pattern in suspicious_patterns:
                if pattern in video_url:
                    return False
            
            return True
            
        except Exception as e:
            logger.warning(f"Error validating video URL '{video_url}': {e}")
            return False
    
    def _is_valid_image_url(self, image_url: str) -> bool:
        """
        Check if the image URL is valid and potentially accessible.
        """
        try:
            if not image_url or not isinstance(image_url, str):
                return False
            
            # Check for common invalid patterns
            if image_url.lower() in ['null', 'none', 'undefined', '']:
                return False
            
            # Must start with http/https or be a Firebase Storage URL
            if not (image_url.startswith('http://') or 
                    image_url.startswith('https://') or
                    'firebasestorage.googleapis.com' in image_url or
                    'storage.googleapis.com' in image_url):
                return False
            
            # Check for suspicious patterns that might indicate broken URLs
            suspicious_patterns = [
                '[object Object]',
                'javascript:',
                'data:text/',
                'blob:',
            ]
            
            for pattern in suspicious_patterns:
                if pattern in image_url:
                    return False
            
            return True
            
        except Exception as e:
            logger.warning(f"Error validating image URL '{image_url}': {e}")
            return False
    
    def _provide_fallback_analysis_for_istock(self, media_item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Provide fallback vision analysis for inaccessible iStock images based on title and metadata.
        """
        enhanced_item = media_item.copy()
        
        # Extract information from title and URL
        title = media_item.get('title', '')
        url = media_item.get('url', '')
        
        # Analyze the title and URL to extract meaningful information
        keywords = []
        categories = []
        description_parts = []
        
        # Extract from title
        if 'business' in title.lower() or 'BusinessFinance' in url:
            keywords.extend(['business', 'finance', 'corporate', 'professional', 'office'])
            categories.extend(['business', 'finance'])
            description_parts.append('Professional business and finance related stock image')
        
        elif 'nature' in title.lower() or 'NatureLandscapes' in url:
            keywords.extend(['nature', 'landscape', 'outdoor', 'scenery', 'environment'])
            categories.extend(['nature', 'landscape'])
            description_parts.append('Natural landscape and outdoor scenery stock image')
        
        elif 'social' in title.lower() or 'social-media' in url:
            keywords.extend(['social media', 'communication', 'digital', 'networking', 'technology'])
            categories.extend(['technology', 'communication'])
            description_parts.append('Social media and digital communication themed stock image')
        
        elif 'holiday' in title.lower() or 'HolidaysSeasonal' in url:
            keywords.extend(['holiday', 'seasonal', 'celebration', 'festive', 'tradition'])
            categories.extend(['holiday', 'celebration'])
            description_parts.append('Holiday and seasonal celebration themed stock image')
        
        elif 'firework' in title.lower() or 'fireworks' in url:
            keywords.extend(['fireworks', 'celebration', 'festive', 'colorful', 'night'])
            categories.extend(['celebration', 'entertainment'])
            description_parts.append('Fireworks display and celebration themed stock image')
        
        elif 'money' in url or 'finance' in title.lower():
            keywords.extend(['money', 'finance', 'currency', 'economic', 'financial'])
            categories.extend(['finance', 'business'])
            description_parts.append('Money and financial themed stock image')
        
        elif 'job' in url.lower() or 'career' in url.lower():
            keywords.extend(['jobs', 'career', 'employment', 'professional', 'work'])
            categories.extend(['career', 'business'])
            description_parts.append('Job and career themed stock image')
        
        else:
            # Generic stock image analysis
            keywords.extend(['stock photo', 'professional', 'high quality', 'commercial'])
            categories.extend(['stock', 'commercial'])
            description_parts.append('Professional stock image from iStock')
        
        # Add generic stock image keywords
        keywords.extend(['istock', 'stock photography', 'royalty free', 'commercial use'])
        
        # Create description
        description = f"{' '.join(description_parts)}. This is a professional stock photograph from iStock suitable for commercial use."
        
        # Add vision analysis data
        enhanced_item.update({
            'visionDescription': description,
            'visionKeywords': list(set(keywords)),  # Remove duplicates
            'visionCategories': list(set(categories)),
            'enhancedSearchText': f"{description} {' '.join(keywords)}"
        })
        
        logger.info(f"Generated fallback analysis for iStock image: {enhanced_item.get('id')} - {len(keywords)} keywords, {len(categories)} categories")
        
        return enhanced_item
    
    def _parse_analysis(self, analysis_text: str) -> Dict[str, Any]:
        """
        Parse the structured vision analysis response into separate fields.
        """
        result = {
            'visionDescription': '',
            'visionKeywords': [],
            'visionCategories': [],
            'enhancedSearchText': ''  # Combined text for search
        }
        
        try:
            lines = analysis_text.strip().split('\n')
            current_section = None
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                if line.startswith('DESCRIPTION:'):
                    current_section = 'description'
                    result['visionDescription'] = line.replace('DESCRIPTION:', '').strip()
                elif line.startswith('KEYWORDS:'):
                    current_section = 'keywords'
                    keywords_text = line.replace('KEYWORDS:', '').strip()
                    result['visionKeywords'] = [k.strip() for k in keywords_text.split(',') if k.strip()]
                elif line.startswith('CATEGORIES:'):
                    current_section = 'categories'
                    categories_text = line.replace('CATEGORIES:', '').strip()
                    result['visionCategories'] = [c.strip() for c in categories_text.split(',') if c.strip()]
                elif current_section == 'description':
                    # Multi-line description
                    result['visionDescription'] += ' ' + line
                elif current_section == 'keywords' and ',' in line:
                    # Additional keywords on new lines
                    additional_keywords = [k.strip() for k in line.split(',') if k.strip()]
                    result['visionKeywords'].extend(additional_keywords)
                elif current_section == 'categories' and ',' in line:
                    # Additional categories on new lines
                    additional_categories = [c.strip() for c in line.split(',') if c.strip()]
                    result['visionCategories'].extend(additional_categories)
            
            # Create combined search text
            search_components = []
            if result['visionDescription']:
                search_components.append(result['visionDescription'])
            if result['visionKeywords']:
                search_components.append(' '.join(result['visionKeywords']))
            if result['visionCategories']:
                search_components.append(' '.join(result['visionCategories']))
            
            result['enhancedSearchText'] = ' '.join(search_components)
            
        except Exception as e:
            logger.error(f"Error parsing vision analysis: {e}")
        
        return result
    
    async def analyze_media_batch(self, media_items: List[Dict[str, Any]], batch_size: int = 5) -> List[Dict[str, Any]]:
        """
        Analyze multiple media items in batches to avoid overwhelming the API.
        
        Args:
            media_items: List of media items to analyze
            batch_size: Number of items to process concurrently
            
        Returns:
            List of enhanced media items with vision analysis
        """
        enhanced_items = []
        
        # Filter to only media items that need analysis (images and videos)
        media_to_analyze = [
            item for item in media_items 
            if item.get('type') in ['image', 'video'] and not item.get('visionDescription')
        ]
        
        # For debugging: log details about what images need analysis
        logger.info(f"Media items breakdown: {len(media_items)} total items")
        
        # Count by type
        type_counts = {}
        for item in media_items:
            item_type = item.get('type', 'unknown')
            if item_type not in type_counts:
                type_counts[item_type] = 0
            type_counts[item_type] += 1
        logger.info(f"Type breakdown: {type_counts}")
        
        # Count analyzed vs unanalyzed media items (images and videos)
        all_media = [item for item in media_items if item.get('type') in ['image', 'video']]
        analyzed_media = [item for item in all_media if item.get('visionDescription')]
        logger.info(f"Media: {len(all_media)} total, {len(analyzed_media)} analyzed, {len(media_to_analyze)} need analysis")
        
        # Log details about unanalyzed media items
        if media_to_analyze:
            logger.info("Unanalyzed media details:")
            for i, item in enumerate(media_to_analyze[:5]):  # Show first 5
                media_type = item.get('type', 'unknown')
                url = item.get('url') or item.get('thumbnailUrl') or item.get('videoUrl') or 'no-url'
                logger.info(f"  {i+1}. Type: {media_type}, ID: {item.get('id', 'no-id')}, Source: {item.get('source', 'no-source')}, URL: {url[:100]}")
            if len(media_to_analyze) > 5:
                logger.info(f"  ... and {len(media_to_analyze) - 5} more")
        
        # If no media need analysis, return original items
        if not media_to_analyze:
            logger.info("No media items require vision analysis")
            return media_items
        
        logger.info(f"Starting batch analysis of {len(media_to_analyze)} media items (batch size: {batch_size})")
        
        # Adaptive batch sizing based on total count
        if len(media_to_analyze) > 50:
            batch_size = min(batch_size * 2, 10)  # Increase batch size for large sets
        
        total_batches = (len(media_to_analyze) + batch_size - 1) // batch_size
        processed_ids = set()
        
        for i in range(0, len(media_to_analyze), batch_size):
            batch = media_to_analyze[i:i+batch_size]
            batch_num = i//batch_size + 1
            logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} media items)")
            
            # Process batch concurrently
            tasks = [self.analyze_media_item(item) for item in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            successful_in_batch = 0
            for result in batch_results:
                if isinstance(result, Exception):
                    logger.error(f"Batch processing error: {result}")
                else:
                    enhanced_items.append(result)
                    processed_ids.add(result.get('id'))
                    successful_in_batch += 1
            
            logger.info(f"Batch {batch_num} completed: {successful_in_batch}/{len(batch)} media items analyzed successfully")
            
            # Adaptive delay based on API performance
            if batch_num < total_batches:
                delay = 0.5 if successful_in_batch == len(batch) else 1.0  # Shorter delay if all succeeded
                await asyncio.sleep(delay)
        
        # Add back any items that weren't processed (non-images or already analyzed)
        for item in media_items:
            if item.get('id') not in processed_ids:
                enhanced_items.append(item)
        
        logger.info(f"Completed batch analysis. Enhanced {len([i for i in enhanced_items if i.get('visionDescription')])} items total.")
        return enhanced_items
    
    def get_analysis_stats(self, media_items: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        Get statistics about vision analysis status for media items.
        
        Returns:
            Dictionary with counts: total_images, total_videos, analyzed, unanalyzed
        """
        images = [item for item in media_items if item.get('type') == 'image']
        videos = [item for item in media_items if item.get('type') == 'video']
        all_media = images + videos
        analyzed = [item for item in all_media if item.get('visionDescription')]
        
        return {
            'total_images': len(images),
            'total_videos': len(videos),
            'total_analyzable_media': len(all_media),
            'analyzed': len(analyzed),
            'unanalyzed': len(all_media) - len(analyzed),
            'total_media': len(media_items)
        }

# Global service instance
_vision_analysis_service = None

def get_vision_analysis_service() -> VisionAnalysisService:
    """Get the global vision analysis service instance."""
    global _vision_analysis_service
    if _vision_analysis_service is None:
        _vision_analysis_service = VisionAnalysisService()
    return _vision_analysis_service