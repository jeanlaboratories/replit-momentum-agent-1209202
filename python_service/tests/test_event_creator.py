import unittest
from unittest.mock import MagicMock, patch
import json
import sys
import os

# Add python_service to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from tools.team_tools import create_event


class TestEventCreator(unittest.TestCase):
    def test_create_event_success_with_api(self):
        """Test create_event succeeds when API is available."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "campaignName": "Test Event",
            "campaignRequest": {"duration": 1, "postsPerDay": 3},
            "totalPosts": 3
        }

        with patch('tools.team_tools.requests.post', return_value=mock_response):
            result = create_event("test event", brand_id="test-brand")

            # Verify results
            self.assertEqual(result['status'], 'success')
            self.assertIn('preview_data', result)
            self.assertEqual(result['preview_data']['campaignName'], 'Test Event')
            self.assertEqual(result['preview_data']['brandId'], 'test-brand')
            self.assertIn('message', result)

    def test_create_event_no_brand_id_returns_error(self):
        """Test create_event returns error without brand_id."""
        # Mock get_brand_context to return None
        with patch('tools.team_tools.get_brand_context', return_value=None):
            result = create_event("test event", brand_id=None)

            self.assertEqual(result['status'], 'error')
            self.assertIn('Brand ID required', result['error'])

    def test_create_event_fallback_on_connection_error(self):
        """Test create_event has fallback when API unavailable."""
        import requests

        with patch('tools.team_tools.requests.post', side_effect=requests.exceptions.ConnectionError()):
            result = create_event("test event for fallback", brand_id="test-brand")

            # Should return fallback response, not error
            self.assertEqual(result['status'], 'success')
            self.assertIn('preview_data', result)
            self.assertIn('message', result)
            # Fallback should still have essential fields
            self.assertEqual(result['preview_data']['brandId'], 'test-brand')
            self.assertEqual(result['preview_data']['action'], 'generate-campaign')

    def test_create_event_api_error_400(self):
        """Test create_event handles 400 error from API."""
        mock_response = MagicMock()
        mock_response.status_code = 400

        with patch('tools.team_tools.requests.post', return_value=mock_response):
            result = create_event("test event", brand_id="test-brand")

            self.assertEqual(result['status'], 'error')
            # Error message should mention team/user authentication
            self.assertIn('team', result['error'].lower())

    def test_create_event_api_error_500(self):
        """Test create_event handles 500 error from API."""
        mock_response = MagicMock()
        mock_response.status_code = 500

        with patch('tools.team_tools.requests.post', return_value=mock_response):
            result = create_event("test event", brand_id="test-brand")

            self.assertEqual(result['status'], 'error')
            self.assertIn('500', result['error'])

    def test_create_event_with_global_context(self):
        """Test create_event uses global brand context when brand_id not provided."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "campaignName": "Context Event",
            "campaignRequest": {},
            "totalPosts": 1
        }

        with patch('tools.team_tools.get_brand_context', return_value='global-brand'):
            with patch('tools.team_tools.requests.post', return_value=mock_response):
                result = create_event("test event", brand_id=None)

                self.assertEqual(result['status'], 'success')
                self.assertEqual(result['preview_data']['brandId'], 'global-brand')


    def test_create_event_with_scheduled_times(self):
        """Test create_event passes scheduled_times parameter to API."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "campaignName": "Scheduled Event",
            "campaignRequest": {"scheduledTimes": ["09:00", "14:00", "18:30"]},
            "totalPosts": 3
        }

        with patch('tools.team_tools.requests.post', return_value=mock_response) as mock_post:
            result = create_event(
                "test event with times",
                brand_id="test-brand",
                scheduled_times="09:00, 14:00, 18:30"
            )

            # Verify request includes scheduledTimes
            call_args = mock_post.call_args
            request_body = call_args[1]['json']
            self.assertIn('scheduledTimes', request_body)
            self.assertEqual(request_body['scheduledTimes'], ['09:00', '14:00', '18:30'])

            # Verify success response
            self.assertEqual(result['status'], 'success')

    def test_create_event_with_tone_of_voice(self):
        """Test create_event passes tone_of_voice parameter to API."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "campaignName": "Playful Event",
            "campaignRequest": {"tones": ["Playful"]},
            "totalPosts": 2
        }

        with patch('tools.team_tools.requests.post', return_value=mock_response) as mock_post:
            result = create_event(
                "test event with tone",
                brand_id="test-brand",
                tone_of_voice="Playful"
            )

            # Verify request includes toneOfVoice
            call_args = mock_post.call_args
            request_body = call_args[1]['json']
            self.assertIn('toneOfVoice', request_body)
            self.assertEqual(request_body['toneOfVoice'], 'Playful')

            # Verify success response
            self.assertEqual(result['status'], 'success')

    def test_create_event_with_both_scheduled_times_and_tone(self):
        """Test create_event passes both scheduled_times and tone_of_voice to API."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "campaignName": "Full Event",
            "campaignRequest": {
                "scheduledTimes": ["10:00", "16:00"],
                "tones": ["Urgent"]
            },
            "totalPosts": 4
        }

        with patch('tools.team_tools.requests.post', return_value=mock_response) as mock_post:
            result = create_event(
                "urgent morning and afternoon event",
                brand_id="test-brand",
                scheduled_times="10:00, 16:00",
                tone_of_voice="Urgent"
            )

            # Verify request includes both parameters
            call_args = mock_post.call_args
            request_body = call_args[1]['json']
            self.assertIn('scheduledTimes', request_body)
            self.assertIn('toneOfVoice', request_body)
            self.assertEqual(request_body['scheduledTimes'], ['10:00', '16:00'])
            self.assertEqual(request_body['toneOfVoice'], 'Urgent')

            # Verify success response
            self.assertEqual(result['status'], 'success')

    def test_create_event_empty_scheduled_times(self):
        """Test create_event handles empty scheduled_times string."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "campaignName": "Event Without Times",
            "campaignRequest": {},
            "totalPosts": 2
        }

        with patch('tools.team_tools.requests.post', return_value=mock_response) as mock_post:
            result = create_event(
                "test event without times",
                brand_id="test-brand",
                scheduled_times=""
            )

            # Verify request has empty scheduledTimes array
            call_args = mock_post.call_args
            request_body = call_args[1]['json']
            self.assertIn('scheduledTimes', request_body)
            self.assertEqual(request_body['scheduledTimes'], [])

            # Verify success response
            self.assertEqual(result['status'], 'success')


if __name__ == '__main__':
    unittest.main()
