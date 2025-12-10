"""
Test music generation with examples from the Lyria 2 notebook.
"""
import unittest
from unittest.mock import MagicMock, patch
import sys
import os
import types
import base64

# Add the parent directory to sys.path
sys.path.insert(0, (os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))))

# Mock external dependencies before importing
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()
sys.modules['firebase_admin.storage'] = MagicMock()
sys.modules['firebase_admin.firestore'] = MagicMock()
sys.modules['google.auth'] = MagicMock()
sys.modules['google.auth.transport'] = MagicMock()
sys.modules['google.auth.transport.requests'] = MagicMock()
sys.modules['requests'] = MagicMock()
sys.modules['requests.exceptions'] = MagicMock()
http_error = type('HTTPError', (Exception,), {})
sys.modules['requests.exceptions'].HTTPError = http_error

# Setup ADK mocks
if 'google' not in sys.modules:
    sys.modules['google'] = types.ModuleType('google')
if 'google.adk' not in sys.modules:
    adk_module = types.ModuleType('google.adk')
    adk_module.__path__ = []
    sys.modules['google.adk'] = adk_module

# Now import the modules to test
from routers.music import generate_music, MusicGenerationRequest


class TestMusicExamples(unittest.IsolatedAsyncioTestCase):
    """Test music generation with notebook examples."""
    
    def setUp(self):
        """Setup common mocks for all tests."""
        self.mock_settings_patcher = patch('routers.music.get_settings')
        self.mock_credentials_patcher = patch('routers.music.get_google_credentials')
        self.mock_send_request_patcher = patch('routers.music.send_request_to_google_api')
        self.mock_storage_patcher = patch('routers.music.storage')
        self.mock_firestore_patcher = patch('routers.music.firestore')
        
        self.mock_settings = self.mock_settings_patcher.start()
        self.mock_credentials = self.mock_credentials_patcher.start()
        self.mock_send_request = self.mock_send_request_patcher.start()
        self.mock_storage = self.mock_storage_patcher.start()
        self.mock_firestore = self.mock_firestore_patcher.start()
        
        # Setup common mocks
        mock_settings_obj = MagicMock()
        mock_settings_obj.effective_project_id = 'test-project'
        self.mock_settings.return_value = mock_settings_obj
        
        mock_creds = MagicMock()
        self.mock_credentials.return_value = (mock_creds, 'test-project')
        
        self.mock_send_request.return_value = {
            "predictions": [
                {
                    "bytesBase64Encoded": base64.b64encode(b"fake_audio_data").decode('utf-8')
                }
            ]
        }
        
        # Mock Firebase Storage
        mock_bucket = MagicMock()
        mock_blob = MagicMock()
        mock_blob.public_url = "https://storage.googleapis.com/test-bucket/music/test.wav"
        mock_bucket.blob.return_value = mock_blob
        self.mock_storage.bucket.return_value = mock_bucket
        
        # Mock Firestore
        mock_db = MagicMock()
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "music-123"
        mock_collection = MagicMock()
        mock_collection.add.return_value = (None, mock_doc_ref)
        mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection
        self.mock_firestore.client.return_value = mock_db

    def tearDown(self):
        """Clean up patches."""
        self.mock_settings_patcher.stop()
        self.mock_credentials_patcher.stop()
        self.mock_send_request_patcher.stop()
        self.mock_storage_patcher.stop()
        self.mock_firestore_patcher.stop()
    
    async def test_smooth_jazz_example(self):
        """Test the smooth jazz example from the notebook."""
        request = MusicGenerationRequest(
            prompt="Smooth, atmospheric jazz. Moderate tempo, rich harmonies. Featuring mellow brass",
            negative_prompt="fast",
            sample_count=2,
            brand_id="test-brand",
            user_id="test-user"
        )
        
        # Mock multiple predictions for sample_count=2
        self.mock_send_request.return_value = {
            "predictions": [
                {"bytesBase64Encoded": base64.b64encode(b"fake_audio_data_1").decode('utf-8')},
                {"bytesBase64Encoded": base64.b64encode(b"fake_audio_data_2").decode('utf-8')}
            ]
        }
        
        result = await generate_music(request)
        
        self.assertTrue(result["success"])
        self.assertEqual(result["count"], 2)
        self.assertEqual(len(result["music"]), 2)
        
        # Verify request payload structure
        call_args = self.mock_send_request.call_args
        request_payload = call_args[0][1]
        instance = request_payload["instances"][0]
        self.assertEqual(instance["prompt"], "Smooth, atmospheric jazz. Moderate tempo, rich harmonies. Featuring mellow brass")
        self.assertEqual(instance["negative_prompt"], "fast")
        self.assertEqual(instance["sample_count"], 2)
        self.assertNotIn("seed", instance)
    
    async def test_dramatic_dance_symphony_example(self):
        """Test the dramatic dance symphony example with seed."""
        request = MusicGenerationRequest(
            prompt="Dramatic dance symphony",
            negative_prompt="",
            seed=111,
            brand_id="test-brand",
            user_id="test-user"
        )
        
        result = await generate_music(request)
        
        self.assertTrue(result["success"])
        self.assertEqual(result["count"], 1)
        
        # Verify request payload structure
        call_args = self.mock_send_request.call_args
        request_payload = call_args[0][1]
        instance = request_payload["instances"][0]
        self.assertEqual(instance["prompt"], "Dramatic dance symphony")
        self.assertEqual(instance["seed"], 111)
        self.assertNotIn("sample_count", instance)
        # negative_prompt should not be included if empty
        self.assertNotIn("negative_prompt", instance)
    
    async def test_acoustic_guitar_example(self):
        """Test the acoustic guitar example."""
        request = MusicGenerationRequest(
            prompt="Acoustic guitar melody with a fast tempo",
            brand_id="test-brand",
            user_id="test-user"
        )
        
        result = await generate_music(request)
        
        self.assertTrue(result["success"])
        self.assertEqual(result["count"], 1)
        
        # Verify request payload structure
        call_args = self.mock_send_request.call_args
        request_payload = call_args[0][1]
        instance = request_payload["instances"][0]
        self.assertEqual(instance["prompt"], "Acoustic guitar melody with a fast tempo")
        self.assertEqual(instance["sample_count"], 1)  # Default sample_count
        self.assertNotIn("seed", instance)
        self.assertNotIn("negative_prompt", instance)  # Not provided
    
    async def test_various_music_styles(self):
        """Test various music styles and genres."""
        test_cases = [
            "Classical piano sonata in minor key",
            "Electronic dance music with heavy bass",
            "Rock anthem with powerful guitar riffs",
            "Ambient soundscape with ethereal pads",
            "Hip hop beat with crisp drums",
            "Pop song with catchy melody",
            "Jazz fusion with syncopated rhythms",
            "Cinematic orchestral score",
            "Lo-fi chill hop for studying",
            "Latin salsa with brass section"
        ]
        
        for prompt in test_cases:
            with self.subTest(prompt=prompt):
                request = MusicGenerationRequest(
                    prompt=prompt,
                    brand_id="test-brand",
                    user_id="test-user"
                )
                
                result = await generate_music(request)
                
                self.assertTrue(result["success"])
                self.assertEqual(result["count"], 1)
                self.assertEqual(result["music"][0]["prompt"], prompt)
    
    async def test_mood_and_emotion_examples(self):
        """Test music generation with different moods and emotions."""
        mood_examples = [
            "Happy uplifting melody",
            "Melancholy piano ballad",
            "Energetic workout music",
            "Calm meditation soundscape",
            "Tense thriller soundtrack",
            "Dreamy atmospheric vocals",
            "Nostalgic vintage jazz",
            "Mysterious dark ambient",
            "Celebratory party anthem",
            "Romantic slow dance"
        ]
        
        for prompt in mood_examples:
            with self.subTest(mood=prompt):
                request = MusicGenerationRequest(
                    prompt=prompt,
                    brand_id="test-brand",
                    user_id="test-user"
                )
                
                result = await generate_music(request)
                
                self.assertTrue(result["success"])
                self.assertEqual(result["count"], 1)
                
                # Verify all generated music has required metadata
                music = result["music"][0]
                self.assertEqual(music["duration"], 30)
                self.assertEqual(music["sampleRate"], 48000)
                self.assertEqual(music["format"], "wav")
                self.assertIn("url", music)
                self.assertIn("id", music)
    
    async def test_tempo_and_instrumentation_examples(self):
        """Test music generation with specific tempo and instrumentation."""
        instrumentation_examples = [
            "Fast tempo piano with strings",
            "Slow acoustic guitar fingerpicking",
            "Medium tempo synthesizer arpeggios",
            "Syncopated jazz drums with bass",
            "Orchestral strings with woodwinds",
            "Electric guitar with distortion",
            "Flute melody with harp accompaniment",
            "Brass section with timpani",
            "Violin solo with chamber orchestra",
            "Electronic beats with analog synths"
        ]
        
        for prompt in instrumentation_examples:
            with self.subTest(instrumentation=prompt):
                request = MusicGenerationRequest(
                    prompt=prompt,
                    brand_id="test-brand",
                    user_id="test-user"
                )
                
                result = await generate_music(request)
                
                self.assertTrue(result["success"])
                self.assertEqual(result["count"], 1)
                
                # Verify API endpoint was called correctly
                call_args = self.mock_send_request.call_args
                endpoint = call_args[0][0]
                self.assertIn("lyria-002:predict", endpoint)
                self.assertIn("test-project", endpoint)


if __name__ == '__main__':
    unittest.main()