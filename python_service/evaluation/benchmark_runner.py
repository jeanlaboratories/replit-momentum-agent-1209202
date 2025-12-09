"""
MOMENTUM Agent Benchmark Runner

Executes evaluation tests against the MOMENTUM agent and collects metrics.
Supports both local and remote (Cloud Run) agent deployment.
"""

import asyncio
import logging
import time
import httpx
import json
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from dataclasses import dataclass

from .test_cases import TestCase, TestSuite, TestCategory, ToolName, get_momentum_test_suite, get_quick_test_suite
from .metrics import TestResult, ToolCallResult, EvaluationMetrics, MetricsCalculator

logger = logging.getLogger(__name__)


@dataclass
class BenchmarkConfig:
    """Configuration for benchmark execution"""
    # Agent endpoint
    base_url: str = "http://localhost:8001"

    # Test parameters
    brand_id: str = "eval_brand"
    user_id: str = "eval_user"
    session_id: str = "eval_session"

    # Execution settings
    timeout_seconds: int = 120  # 2 minutes max per test
    max_retries: int = 2
    parallel_tests: bool = False  # Run tests sequentially by default

    # Cost tracking (approximate)
    model_name: str = "gemini-2.0-flash"

    # Output settings
    verbose: bool = True
    save_responses: bool = True


class MomentumBenchmarkRunner:
    """
    Benchmark runner for MOMENTUM agent evaluation.

    Inspired by:
    - BFCL: Tool selection accuracy measurement
    - AgentBench: Multi-turn interaction evaluation
    - GAIA: Task completion assessment
    - CLASSic: Cost, Latency, Accuracy, Stability, Security metrics
    """

    def __init__(self, config: Optional[BenchmarkConfig] = None):
        self.config = config or BenchmarkConfig()
        self.http_client: Optional[httpx.AsyncClient] = None
        self.results: List[TestResult] = []

    async def __aenter__(self):
        self.http_client = httpx.AsyncClient(timeout=self.config.timeout_seconds)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.http_client:
            await self.http_client.aclose()

    async def check_agent_status(self) -> bool:
        """Check if the MOMENTUM agent is available"""
        try:
            response = await self.http_client.get(f"{self.config.base_url}/agent/status")
            if response.status_code == 200:
                data = response.json()
                return data.get("status") == "available"
            return False
        except Exception as e:
            logger.error(f"Agent status check failed: {e}")
            return False

    async def send_message(
        self,
        message: str,
        session_id: Optional[str] = None,
        media: Optional[List[Dict]] = None,
        team_context: Optional[Dict] = None
    ) -> Tuple[str, List[str], float, int]:
        """
        Send a message to the MOMENTUM agent.

        Returns:
            Tuple of (response_text, tool_calls, latency_ms, estimated_tokens)
        """
        start_time = time.time()

        payload = {
            "message": message,
            "brand_id": self.config.brand_id,
            "user_id": self.config.user_id,
            "session_id": session_id or self.config.session_id,
            "media": media or [],
            "team_context": team_context or {},
            "settings": {}
        }

        try:
            response = await self.http_client.post(
                f"{self.config.base_url}/agent/chat",
                json=payload
            )

            latency_ms = (time.time() - start_time) * 1000

            if response.status_code == 200:
                # Parse streaming response (newline-delimited JSON)
                response_text = ""
                tool_calls = []
                has_error = False

                for line in response.text.strip().split("\n"):
                    if line:
                        try:
                            event = json.loads(line)
                            # Check for API errors (rate limits, etc.)
                            if event.get("type") == "error":
                                error_content = event.get("content", "")
                                if "429" in error_content or "RESOURCE_EXHAUSTED" in error_content:
                                    logger.warning("Rate limited - waiting before retry")
                                    has_error = True
                                    response_text = f"[RATE_LIMITED] {error_content[:200]}"
                                else:
                                    response_text = f"[ERROR] {error_content[:200]}"
                                    has_error = True
                            elif event.get("type") == "final_response":
                                response_text = event.get("content", "")
                            elif event.get("type") == "response":
                                response_text = event.get("text", "") or event.get("content", "")
                            elif event.get("type") == "log":
                                # Extract tool calls from log messages
                                # Format is: "✓ {tool_name} completed" or "{emoji} Using {tool}..."
                                content = event.get("content", "")
                                # Method 1: Check for completion log "✓ {tool_name} completed"
                                if "completed" in content and "✓" in content:
                                    # Extract tool name: "✓ save_memory completed" -> "save_memory"
                                    tool_name = content.replace("✓", "").replace("completed", "").strip()
                                    if tool_name and tool_name not in tool_calls:
                                        tool_calls.append(tool_name)
                                # Method 2: Check for thinking logs like "🎨 Generating image..."
                                elif any(indicator in content.lower() for indicator in [
                                    "generating image", "generating video", "editing image",
                                    "searching the web", "crawling website", "creating event",
                                    "recalling from memory", "saving to memory", "analyzing youtube"
                                ]):
                                    # Map thinking messages to tool names
                                    if "generating image" in content.lower():
                                        if "generate_image" not in tool_calls:
                                            tool_calls.append("generate_image")
                                    elif "generating video" in content.lower():
                                        if "generate_video" not in tool_calls:
                                            tool_calls.append("generate_video")
                                    elif "editing image" in content.lower() or "nano banana" in content.lower():
                                        if "nano_banana" not in tool_calls:
                                            tool_calls.append("nano_banana")
                                    elif "searching the web" in content.lower():
                                        if "web_search_agent" not in tool_calls:
                                            tool_calls.append("web_search_agent")
                                    elif "crawling website" in content.lower():
                                        if "crawl_website" not in tool_calls:
                                            tool_calls.append("crawl_website")
                                    elif "creating event" in content.lower():
                                        if "create_event" not in tool_calls:
                                            tool_calls.append("create_event")
                                    elif "recalling from memory" in content.lower():
                                        if "recall_memory" not in tool_calls:
                                            tool_calls.append("recall_memory")
                                    elif "saving to memory" in content.lower():
                                        if "save_memory" not in tool_calls:
                                            tool_calls.append("save_memory")
                                    elif "analyzing youtube" in content.lower():
                                        if "process_youtube_video" not in tool_calls:
                                            tool_calls.append("process_youtube_video")
                            elif event.get("type") == "tool_calls":
                                tool_calls.extend(event.get("tools", []))
                        except json.JSONDecodeError:
                            continue

                # Estimate tokens (rough approximation)
                estimated_tokens = len(message.split()) * 2 + len(response_text.split()) * 2

                return response_text, tool_calls, latency_ms, estimated_tokens
            else:
                logger.error(f"Agent returned status {response.status_code}: {response.text}")
                return "", [], latency_ms, 0

        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            logger.error(f"Error sending message: {e}")
            return "", [], latency_ms, 0

    def normalize_tool_name(self, tool_name: str) -> str:
        """Normalize tool name for comparison"""
        # Map emoji/display names to canonical names
        name_map = {
            "🎨 generating image": "generate_image",
            "🎬 generating video": "generate_video",
            "🍌 editing image with nano banana": "nano_banana",
            "🔍 searching the web": "web_search_agent",
            "🌐 crawling website": "crawl_website",
            "📅 creating event": "create_event",
            "💭 recalling from memory": "recall_memory",
            "💾 saving to memory": "save_memory",
            "📺 analyzing youtube video": "process_youtube_video",
        }

        normalized = tool_name.lower().strip()
        return name_map.get(normalized, normalized.replace(" ", "_"))

    def evaluate_tool_selection(
        self,
        expected_tools: List[ToolName],
        actual_tools: List[str]
    ) -> Tuple[bool, List[ToolCallResult]]:
        """
        Evaluate if the correct tools were called.

        Returns:
            Tuple of (passed, tool_call_results)
        """
        expected_set = {t.value for t in expected_tools}
        actual_set = {self.normalize_tool_name(t) for t in actual_tools}

        # Handle NO_TOOL case
        if ToolName.NO_TOOL in expected_tools:
            passed = len(actual_tools) == 0
            return passed, []

        # Check if expected tools were called
        tool_results = []
        for expected in expected_set:
            was_called = expected in actual_set
            tool_results.append(ToolCallResult(
                tool_name=expected,
                was_expected=True,
                latency_ms=0,  # We don't have per-tool latency
                success=was_called,
                error=None if was_called else f"Expected tool {expected} was not called"
            ))

        # Check for unexpected tools
        for actual in actual_set:
            if actual not in expected_set:
                tool_results.append(ToolCallResult(
                    tool_name=actual,
                    was_expected=False,
                    latency_ms=0,
                    success=False,
                    error=f"Unexpected tool {actual} was called"
                ))

        # Pass if all expected tools were called (ignoring order and extras for now)
        passed = expected_set <= actual_set or (expected_set == actual_set)

        return passed, tool_results

    def evaluate_response_content(
        self,
        response: str,
        expected_in_response: Optional[List[str]],
        not_expected_in_response: Optional[List[str]]
    ) -> Tuple[bool, List[str]]:
        """
        Evaluate response content for expected/unexpected strings.

        Returns:
            Tuple of (passed, errors)
        """
        errors = []
        response_lower = response.lower()

        if expected_in_response:
            for expected in expected_in_response:
                if expected.lower() not in response_lower:
                    errors.append(f"Expected '{expected}' not found in response")

        if not_expected_in_response:
            for not_expected in not_expected_in_response:
                if not_expected.lower() in response_lower:
                    errors.append(f"Unexpected '{not_expected}' found in response")

        return len(errors) == 0, errors

    async def run_single_test(self, test_case: TestCase) -> TestResult:
        """Run a single test case and return the result"""
        if self.config.verbose:
            print(f"  Running test: {test_case.id} - {test_case.description}")

        # Prepare context if needed
        media = None
        if test_case.context and test_case.context.get("has_media_attachment"):
            media = [{
                "type": test_case.context.get("media_type", "image"),
                "url": "https://example.com/test_image.jpg",
                "fileName": "test_image.jpg"
            }]

        team_context = None
        if test_case.context and test_case.context.get("brand_id"):
            team_context = {"brand_id": test_case.context["brand_id"]}

        # Create unique session for this test
        session_id = f"eval_{test_case.id}_{int(time.time())}"

        # Send message
        response_text, tool_calls, latency_ms, tokens = await self.send_message(
            message=test_case.user_message,
            session_id=session_id,
            media=media,
            team_context=team_context
        )

        # Evaluate tool selection
        tool_passed, tool_results = self.evaluate_tool_selection(
            test_case.expected_tools,
            tool_calls
        )

        # Evaluate response content
        content_passed, content_errors = self.evaluate_response_content(
            response_text,
            test_case.expected_in_response,
            test_case.not_expected_in_response
        )

        # Overall pass/fail
        passed = tool_passed and content_passed

        # Estimate cost
        cost = self._estimate_cost(tokens)

        return TestResult(
            test_id=test_case.id,
            category=test_case.category.value,
            passed=passed,
            tool_calls=tool_results,
            expected_tools=[t.value for t in test_case.expected_tools],
            actual_tools=tool_calls,
            response_text=response_text,
            latency_ms=latency_ms,
            tokens_used=tokens,
            cost_usd=cost,
            errors=content_errors,
            metadata={"tags": test_case.tags, "difficulty": test_case.difficulty}
        )

    async def run_multi_turn_test(self, test_case: TestCase) -> TestResult:
        """Run a multi-turn test case"""
        if self.config.verbose:
            print(f"  Running multi-turn test: {test_case.id}")

        session_id = f"eval_mt_{test_case.id}_{int(time.time())}"
        total_latency = 0
        total_tokens = 0
        all_tool_calls = []
        final_response = ""

        # Send initial message
        response, tools, latency, tokens = await self.send_message(
            message=test_case.user_message,
            session_id=session_id
        )
        total_latency += latency
        total_tokens += tokens
        all_tool_calls.extend(tools)

        # Send follow-up messages
        if test_case.follow_up_messages:
            for follow_up in test_case.follow_up_messages:
                response, tools, latency, tokens = await self.send_message(
                    message=follow_up,
                    session_id=session_id
                )
                total_latency += latency
                total_tokens += tokens
                all_tool_calls.extend(tools)
                final_response = response

        # Evaluate final response for expected content
        content_passed, content_errors = self.evaluate_response_content(
            final_response,
            test_case.expected_in_response,
            test_case.not_expected_in_response
        )

        return TestResult(
            test_id=test_case.id,
            category=test_case.category.value,
            passed=content_passed,
            tool_calls=[],
            expected_tools=[t.value for t in test_case.expected_tools],
            actual_tools=all_tool_calls,
            response_text=final_response,
            latency_ms=total_latency,
            tokens_used=total_tokens,
            cost_usd=self._estimate_cost(total_tokens),
            errors=content_errors,
            metadata={"tags": test_case.tags, "difficulty": test_case.difficulty}
        )

    def _estimate_cost(self, tokens: int) -> float:
        """Estimate cost based on token count"""
        pricing = MetricsCalculator.PRICING.get(
            self.config.model_name,
            MetricsCalculator.PRICING["default"]
        )
        # Assume 60% input, 40% output split
        input_tokens = tokens * 0.6
        output_tokens = tokens * 0.4
        return (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000

    async def run_test_suite(
        self,
        suite: Optional[TestSuite] = None,
        categories: Optional[List[TestCategory]] = None,
        max_tests: Optional[int] = None
    ) -> EvaluationMetrics:
        """
        Run the full evaluation test suite.

        Args:
            suite: Test suite to run (defaults to full MOMENTUM suite)
            categories: Filter to specific categories
            max_tests: Maximum number of tests to run

        Returns:
            EvaluationMetrics with complete results
        """
        if suite is None:
            suite = get_momentum_test_suite()

        # Filter tests
        test_cases = suite.test_cases
        if categories:
            test_cases = [tc for tc in test_cases if tc.category in categories]
        if max_tests:
            test_cases = test_cases[:max_tests]

        print(f"\n{'='*60}")
        print(f"MOMENTUM Agent Evaluation")
        print(f"{'='*60}")
        print(f"Suite: {suite.name}")
        print(f"Tests: {len(test_cases)}")
        print(f"Endpoint: {self.config.base_url}")
        print(f"{'='*60}\n")

        # Check agent status
        if not await self.check_agent_status():
            print("⚠️  WARNING: Agent may not be available. Proceeding anyway...")
        else:
            print("✓ Agent is available\n")

        # Run tests
        self.results = []
        for i, test_case in enumerate(test_cases, 1):
            print(f"[{i}/{len(test_cases)}]", end=" ")

            try:
                if test_case.category in [TestCategory.MULTI_TURN, TestCategory.MEMORY_PERSISTENCE]:
                    result = await self.run_multi_turn_test(test_case)
                else:
                    result = await self.run_single_test(test_case)

                self.results.append(result)

                # Print result
                status = "✓ PASS" if result.passed else "✗ FAIL"
                print(f"{status} ({result.latency_ms:.0f}ms)")

                if not result.passed and self.config.verbose:
                    print(f"    Expected tools: {result.expected_tools}")
                    print(f"    Actual tools: {result.actual_tools}")
                    if not result.actual_tools:
                        print(f"    Response preview: {result.response_text[:200]}...")
                    for error in result.errors:
                        print(f"    Error: {error}")

            except Exception as e:
                logger.error(f"Test {test_case.id} failed with exception: {e}")
                self.results.append(TestResult(
                    test_id=test_case.id,
                    category=test_case.category.value,
                    passed=False,
                    tool_calls=[],
                    expected_tools=[t.value for t in test_case.expected_tools],
                    actual_tools=[],
                    response_text="",
                    latency_ms=0,
                    tokens_used=0,
                    cost_usd=0,
                    errors=[str(e)],
                    metadata={"tags": test_case.tags, "difficulty": test_case.difficulty}
                ))
                print(f"✗ ERROR: {e}")

            # Delay between tests to avoid rate limiting
            # Longer delay after media generation tests
            delay = 2.0 if test_case.category == TestCategory.MULTI_MODAL else 1.0
            await asyncio.sleep(delay)

        # Calculate metrics
        metrics = MetricsCalculator.calculate_all_metrics(self.results, suite.name)

        return metrics

    async def run_quick_evaluation(self) -> EvaluationMetrics:
        """Run a quick evaluation with a subset of tests"""
        return await self.run_test_suite(suite=get_quick_test_suite())


async def run_evaluation(
    base_url: str = "http://localhost:8001",
    quick: bool = False,
    output_file: Optional[str] = None
) -> EvaluationMetrics:
    """
    Main entry point for running MOMENTUM agent evaluation.

    Args:
        base_url: Agent API endpoint
        quick: Run quick test suite instead of full
        output_file: Path to save JSON results

    Returns:
        EvaluationMetrics with complete results
    """
    config = BenchmarkConfig(base_url=base_url)

    async with MomentumBenchmarkRunner(config) as runner:
        if quick:
            metrics = await runner.run_quick_evaluation()
        else:
            metrics = await runner.run_test_suite()

    # Print summary
    metrics.print_summary()

    # Save results if requested
    if output_file:
        with open(output_file, 'w') as f:
            f.write(metrics.to_json())
        print(f"\nResults saved to: {output_file}")

    return metrics


# CLI entry point
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="MOMENTUM Agent Evaluation")
    parser.add_argument("--url", default="http://localhost:8001", help="Agent API URL")
    parser.add_argument("--quick", action="store_true", help="Run quick test suite")
    parser.add_argument("--output", "-o", help="Output JSON file path")

    args = parser.parse_args()

    metrics = asyncio.run(run_evaluation(
        base_url=args.url,
        quick=args.quick,
        output_file=args.output
    ))
