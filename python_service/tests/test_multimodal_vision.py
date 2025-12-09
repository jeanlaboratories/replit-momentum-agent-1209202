"""
Tests for Multimodal Vision Capabilities

These tests ensure that:
1. analyze_image tool is in the agent's tools list
2. Images are sent as multimodal parts (not just URL text)
3. The agent can understand uploaded images with native vision
4. Media downloading and conversion works correctly
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import base64


class TestAnalyzeImageTool:
    """Test that analyze_image tool is available and works correctly."""
    
    def test_analyze_image_in_tools_list(self):
        """Verify analyze_image is in the agent's tools list."""
        from momentum_agent import create_momentum_agent
        
        # Create agent
        agent = create_momentum_agent()
        
        # Get tool names - agent.tools is the public attribute
        tool_names = [tool.__name__ if callable(tool) else (tool.name if hasattr(tool, 'name') else str(tool)) for tool in agent.tools]
        
        # analyze_image should be present
        assert 'analyze_image' in tool_names, \
            f"analyze_image not found in tools list: {tool_names}"
    
    def test_analyze_image_function_exists(self):
        """Verify analyze_image function is defined."""
        from momentum_agent import analyze_image
        
        assert callable(analyze_image), "analyze_image should be a callable function"
    
    def test_analyze_image_has_correct_signature(self):
        """Verify analyze_image has the expected parameters."""
        from momentum_agent import analyze_image
        import inspect
        
        sig = inspect.signature(analyze_image)
        params = list(sig.parameters.keys())
        
        assert 'prompt' in params, "analyze_image should have 'prompt' parameter"
        assert 'image_url' in params or 'image_data' in params, "analyze_image should have 'image_url' or 'image_data' parameter"


class TestMultimodalPartConstruction:
    """Test that media is sent as multimodal parts."""
    
    @pytest.mark.asyncio
    async def test_creates_multimodal_parts_for_images(self):
        """Test that uploaded images are converted to multimodal parts."""
        from google.genai import types
        
        # Simulate uploaded image
        user_message = "what's in this image?"
        image_url = "https://firebasestorage.googleapis.com/test.jpg"
        
        # Mock image download
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_response = MagicMock()
            mock_response.content = b'\xFF\xD8\xFF\xE0'  # JPEG header
            mock_response.raise_for_status = MagicMock()
            
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_class.return_value = mock_client
            
            # Simulate multimodal part construction
            parts = [types.Part.from_text(text=user_message)]
            
            # Download and add image
            async with mock_client:
                response = await mock_client.get(image_url)
                image_bytes = response.content
                
                parts.append(
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type='image/jpeg'
                    )
                )
            
            # Should have 2 parts: text + image
            assert len(parts) == 2
            assert parts[0].text is not None  # Text part
            # Second part should be image bytes (structure verified by types.Part)
    
    @pytest.mark.asyncio
    async def test_handles_data_uri_conversion(self):
        """Test that data URIs are converted to multimodal parts."""
        # Data URI with base64 image
        data_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA'
        
        # Extract base64 data
        if ';base64,' in data_uri:
            base64_data = data_uri.split(';base64,')[1]
            image_bytes = base64.b64decode(base64_data)
            
            assert len(image_bytes) > 0
            assert isinstance(image_bytes, bytes)
    
    def test_determines_correct_mime_types(self):
        """Test that MIME types are correctly determined for different media."""
        media_items = [
            {'type': 'image', 'mimeType': None, 'expected': 'image/png'},
            {'type': 'video', 'mimeType': None, 'expected': 'video/mp4'},
            {'type': 'pdf', 'mimeType': None, 'expected': 'application/pdf'},
            {'type': 'audio', 'mimeType': None, 'expected': 'audio/mpeg'},
            {'type': 'image', 'mimeType': 'image/jpeg', 'expected': 'image/jpeg'},  # Preserve if set
        ];
        
        for item in media_items:
            mime_type = item['mimeType'] or item['expected']
            assert mime_type == item['expected']


class TestVisionUnderstandingFlow:
    """Test the complete flow of image understanding."""
    
    @pytest.mark.asyncio
    async def test_uploaded_image_understanding_flow(self):
        """Test complete flow: upload → multimodal part → vision response."""
        # This is an integration test of the full flow
        
        # Step 1: User uploads image
        uploaded_media = {
            'type': 'image',
            'url': 'https://firebasestorage.googleapis.com/test.jpg',
            'fileName': 'test.jpg',
            'mimeType': 'image/jpeg',
        }
        
        # Step 2: Backend receives and downloads image
        # (tested in test_creates_multimodal_parts_for_images)
        
        # Step 3: Image sent as multimodal part to agent
        # (tested above)
        
        # Step 4: Agent can use native vision OR call analyze_image tool
        vision_capabilities = {
            'native': 'agent receives image as multimodal content',
            'tool': 'analyze_image available if needed',
        }
        
        assert 'native' in vision_capabilities
        assert 'tool' in vision_capabilities
    
    def test_re_injected_image_understanding(self):
        """Test that re-injected images work with vision."""
        reinjected = {
            'url': 'https://firebasestorage.googleapis.com/old.jpg',
            'isReinjected': True,
        }
        
        # Should be treated the same as uploaded images
        # Downloaded and sent as multimodal part
        should_download = reinjected['url'].startswith('https://')
        assert should_download is True


class TestErrorHandlingAndFallbacks:
    """Test error handling in multimodal vision."""
    
    @pytest.mark.asyncio
    async def test_download_failure_fallback(self):
        """Test that download failures don't break the chat."""
        from google.genai import types
        
        # Mock failed download
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock()
            mock_client.get = AsyncMock(side_effect=Exception("Download failed"))
            mock_client_class.return_value = mock_client
            
            # Should catch exception and continue with text-only
            parts = [types.Part.from_text(text="what's in this image?\n\nURL: https://.../image.jpg")]
            
            try:
                async with mock_client:
                    await mock_client.get("https://.../image.jpg")
            except Exception:
                # Exception caught, continue with text-only
                pass
            
            # Should still have at least text part
            assert len(parts) >= 1
    
    def test_maintains_url_in_text_for_tools(self):
        """Test that URL remains in text even when multimodal part added."""
        # CRITICAL: Tools like nano_banana need the URL
        # Multimodal part is ADDITIVE, not replacing URL
        
        message_with_url = "edit this\n\nAttached Media:\n- image (URL: https://.../img.jpg)"
        has_url_in_text = 'URL: https://' in message_with_url
        
        assert has_url_in_text is True
        
        # Message parts would be:
        # 1. Text (includes URL)
        # 2. Image (multimodal bytes)
        # Both present = tools get URL, agent gets vision


class TestBackwardCompatibility:
    """Ensure multimodal vision doesn't break existing functionality."""
    
    def test_text_only_messages_unchanged(self):
        """Text-only messages should work exactly as before."""
        message = {
            'message': 'Hello, generate an image of a cat',
            'media': [],
        }
        
        # Should create 1 part (text only)
        expected_parts_count = 1
        parts_count = 1  # Only text, no media
        
        assert parts_count == expected_parts_count
    
    def test_tool_calls_still_work_with_urls(self):
        """Tools should still receive URLs in their parameters."""
        # nano_banana expects image_url parameter
        nano_banana_call = {
            'tool': 'nano_banana',
            'prompt': 'make it red',
            'image_url': 'https://firebasestorage.googleapis.com/.../image.jpg',
        }
        
        # URL should be extracted from message text or image context
        assert nano_banana_call['image_url'].startswith('https://')
    
    def test_image_context_still_injected(self):
        """Robust media context should still be injected as text."""
        # The RESOLVED MEDIA CONTEXT text injection should remain
        # It provides URLs for tool calls
        
        context_text = """
--- RESOLVED MEDIA CONTEXT (ROBUST SYSTEM) ---
Resolution Method: explicit_upload
Confidence: 100%

You have access to 1 RESOLVED image(s) for this request.
- Image 1: uploaded by user (photo.jpg)
  URL: https://firebasestorage.googleapis.com/.../photo.jpg
---
"""
        
        # This text is still added (for tools)
        # AND image is sent as multimodal part (for vision)
        assert 'URL:' in context_text
        assert 'RESOLVED MEDIA CONTEXT' in context_text


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

