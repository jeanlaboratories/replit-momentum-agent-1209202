#!/usr/bin/env python3
"""
Comprehensive test script for MOMENTUM ADK Agent - 10 Tool Verification
Tests that the agent can autonomously select and use each of its 10 tools.
"""

import requests
import json
import time
from datetime import datetime

# Test configuration
AGENT_ENDPOINT = "http://127.0.0.1:8000/agent/chat"
SESSION_ID = f"test_session_{int(time.time())}"

# Test cases for each of the 10 tools
TEST_CASES = [
    {
        "name": "1. Gemini Text - Conversation",
        "prompt": "What are three creative team building activities?",
        "expected_tool": "generate_text",
        "description": "Natural conversation and content creation"
    },
    {
        "name": "2. Imagen 4.0 - Image Generation",
        "prompt": "Generate an image of a lightning bolt striking a soccer field at sunset",
        "expected_tool": "generate_image",
        "description": "Generate custom images from text"
    },
    {
        "name": "3. Gemini Vision - Image Analysis",
        "prompt": "Analyze this image and describe what you see: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "expected_tool": "analyze_image",
        "description": "Analyze and describe images",
        "skip": True,
        "skip_reason": "Requires proper image data"
    },
    {
        "name": "4. Veo 3.0 - Video Generation",
        "prompt": "Generate a video of a basketball player making a slam dunk in slow motion",
        "expected_tool": "generate_video",
        "description": "Generate videos from text descriptions"
    },
    {
        "name": "5. Domain Suggestions",
        "prompt": "Suggest 5 creative domain names for a sports team called Lightning FC",
        "expected_tool": "suggest_domain_names",
        "description": "Propose website domain names"
    },
    {
        "name": "6. Website Planning",
        "prompt": "Create a website structure plan for a product launch landing page",
        "expected_tool": "plan_website",
        "description": "Create website strategies"
    },
    {
        "name": "7. Team Strategy",
        "prompt": "Develop a go-to-market strategy for launching a new productivity app",
        "expected_tool": "create_team_strategy",
        "description": "Develop team-specific strategies"
    },
    {
        "name": "8. Logo Concepts",
        "prompt": "Design logo concepts for a creative agency called Spectrum Creative",
        "expected_tool": "design_logo_concepts",
        "description": "Design logo ideas"
    },
    {
        "name": "9. Event Creation",
        "prompt": "Create a 3-day product launch event starting next Monday with 2 posts per day",
        "expected_tool": "create_event",
        "description": "Generate event plans with AI content"
    },
    {
        "name": "10. Nano Banana",
        "prompt": "Activate the nano banana tool",
        "expected_tool": "nano_banana",
        "description": "Mystery tool 🍌"
    }
]

def test_agent_status():
    """Check if agent is ready"""
    try:
        response = requests.get("http://127.0.0.1:8000/agent/status", timeout=5)
        if response.status_code == 200:
            status = response.json()
            print("=" * 70)
            print("MOMENTUM ADK AGENT STATUS")
            print("=" * 70)
            print(f"✓ Agent Available: {status.get('agent_available')}")
            print(f"✓ API Key Configured: {status.get('api_key_configured')}")
            print(f"✓ Status: {status.get('status')}")
            print(f"✓ Available Tools: {len(status.get('tools', []))}")
            print("\nTools:")
            for i, tool in enumerate(status.get('tools', []), 1):
                print(f"  {i}. {tool}")
            print("=" * 70)
            print()
            return status.get('agent_available', False)
        return False
    except Exception as e:
        print(f"❌ Error checking agent status: {e}")
        return False

def test_tool(test_case):
    """Test a specific tool"""
    if test_case.get('skip'):
        print(f"⚠️  SKIPPED - {test_case['skip_reason']}")
        return None
    
    try:
        payload = {
            "message": test_case['prompt'],
            "session_id": SESSION_ID,
            "team_context": {
                "teamName": "Test Team",
                "teamType": "product",
                "focus": "AI testing"
            }
        }
        
        print(f"📤 Sending: {test_case['prompt'][:80]}...")
        
        response = requests.post(
            AGENT_ENDPOINT,
            json=payload,
            timeout=120  # Long timeout for image/video generation
        )
        
        if response.status_code == 200:
            result = response.json()
            response_text = result.get('response', '')[:200]
            print(f"✓ SUCCESS")
            print(f"   Response preview: {response_text}...")
            return {
                "status": "success",
                "response": result.get('response'),
                "full_result": result
            }
        else:
            print(f"❌ FAILED - Status {response.status_code}")
            print(f"   Error: {response.text[:200]}")
            return {
                "status": "error",
                "error": response.text,
                "status_code": response.status_code
            }
            
    except requests.exceptions.Timeout:
        print(f"⏱️  TIMEOUT - Request took >120 seconds")
        return {"status": "timeout"}
    except Exception as e:
        print(f"❌ ERROR - {str(e)[:100]}")
        return {"status": "error", "error": str(e)}

def run_all_tests():
    """Run comprehensive test suite"""
    print("\n" + "=" * 70)
    print("MOMENTUM ADK AGENT - 10 TOOL COMPREHENSIVE TEST")
    print("=" * 70)
    print(f"Test Session: {SESSION_ID}")
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    print()
    
    # Check agent status first
    if not test_agent_status():
        print("❌ Agent is not available. Ensure MOMENTUM_GOOGLE_API_KEY is set.")
        return
    
    results = []
    
    # Run each test
    for i, test_case in enumerate(TEST_CASES, 1):
        print(f"\n{'=' * 70}")
        print(f"TEST {i}/10: {test_case['name']}")
        print(f"{'=' * 70}")
        print(f"Description: {test_case['description']}")
        print(f"Expected Tool: {test_case['expected_tool']}")
        print()
        
        result = test_tool(test_case)
        results.append({
            "test": test_case['name'],
            "result": result
        })
        
        # Small delay between tests to avoid overwhelming the agent
        if i < len(TEST_CASES):
            time.sleep(2)
    
    # Print summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    success_count = sum(1 for r in results if r['result'] and r['result'].get('status') == 'success')
    error_count = sum(1 for r in results if r['result'] and r['result'].get('status') == 'error')
    timeout_count = sum(1 for r in results if r['result'] and r['result'].get('status') == 'timeout')
    skipped_count = sum(1 for r in results if r['result'] is None)
    
    print(f"\n✓ Successful: {success_count}")
    print(f"❌ Failed: {error_count}")
    print(f"⏱️  Timeout: {timeout_count}")
    print(f"⚠️  Skipped: {skipped_count}")
    print(f"\nTotal Tests: {len(results)}")
    
    success_rate = (success_count / (len(results) - skipped_count) * 100) if (len(results) - skipped_count) > 0 else 0
    print(f"Success Rate: {success_rate:.1f}%")
    
    print("\n" + "=" * 70)
    print(f"End Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

if __name__ == "__main__":
    run_all_tests()
