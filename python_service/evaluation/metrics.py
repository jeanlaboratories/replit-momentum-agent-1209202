"""
Evaluation Metrics for MOMENTUM Agent

Implements metrics inspired by:
- BFCL: Tool selection accuracy
- GAIA: Task completion rate
- LOCOMO: Memory recall accuracy
- CLASSic: Cost, Latency, Accuracy, Stability, Security
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
import statistics
import json


@dataclass
class ToolCallResult:
    """Result of a tool call within a test"""
    tool_name: str
    was_expected: bool
    latency_ms: float
    success: bool
    error: Optional[str] = None


@dataclass
class TestResult:
    """Result of a single test case"""
    test_id: str
    category: str
    passed: bool
    tool_calls: List[ToolCallResult]
    expected_tools: List[str]
    actual_tools: List[str]
    response_text: str
    latency_ms: float
    tokens_used: int = 0
    cost_usd: float = 0.0
    errors: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CategoryMetrics:
    """Aggregated metrics for a test category"""
    category: str
    total_tests: int
    passed_tests: int
    accuracy: float
    avg_latency_ms: float
    p95_latency_ms: float
    total_tokens: int
    total_cost_usd: float
    tool_selection_accuracy: float
    false_positive_rate: float  # Called tool when shouldn't
    false_negative_rate: float  # Didn't call tool when should


@dataclass
class EvaluationMetrics:
    """Complete evaluation metrics"""
    timestamp: str
    suite_name: str
    total_tests: int
    passed_tests: int
    overall_accuracy: float
    category_metrics: Dict[str, CategoryMetrics]
    tool_accuracy_by_tool: Dict[str, float]
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    total_tokens: int
    total_cost_usd: float
    pass_at_k: Dict[int, float]  # pass@1, pass@3 metrics
    stability_score: float
    individual_results: List[TestResult]

    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary for JSON serialization"""
        return {
            "timestamp": self.timestamp,
            "suite_name": self.suite_name,
            "summary": {
                "total_tests": self.total_tests,
                "passed_tests": self.passed_tests,
                "overall_accuracy": round(self.overall_accuracy * 100, 2),
                "stability_score": round(self.stability_score * 100, 2),
            },
            "latency": {
                "avg_ms": round(self.avg_latency_ms, 2),
                "p50_ms": round(self.p50_latency_ms, 2),
                "p95_ms": round(self.p95_latency_ms, 2),
                "p99_ms": round(self.p99_latency_ms, 2),
            },
            "cost": {
                "total_tokens": self.total_tokens,
                "total_cost_usd": round(self.total_cost_usd, 4),
            },
            "pass_at_k": {f"pass@{k}": round(v * 100, 2) for k, v in self.pass_at_k.items()},
            "tool_accuracy": {tool: round(acc * 100, 2) for tool, acc in self.tool_accuracy_by_tool.items()},
            "category_metrics": {
                cat: {
                    "accuracy": round(m.accuracy * 100, 2),
                    "tool_selection_accuracy": round(m.tool_selection_accuracy * 100, 2),
                    "avg_latency_ms": round(m.avg_latency_ms, 2),
                    "tests": m.total_tests,
                    "passed": m.passed_tests,
                }
                for cat, m in self.category_metrics.items()
            },
        }

    def to_json(self, indent: int = 2) -> str:
        """Convert metrics to JSON string"""
        return json.dumps(self.to_dict(), indent=indent)

    def print_summary(self):
        """Print a formatted summary of evaluation results"""
        print("\n" + "=" * 70)
        print("MOMENTUM AGENT EVALUATION RESULTS")
        print("=" * 70)
        print(f"Suite: {self.suite_name}")
        print(f"Timestamp: {self.timestamp}")
        print()

        # Overall Summary
        print("OVERALL SUMMARY")
        print("-" * 40)
        print(f"  Total Tests:      {self.total_tests}")
        print(f"  Passed Tests:     {self.passed_tests}")
        print(f"  Overall Accuracy: {self.overall_accuracy * 100:.1f}%")
        print(f"  Stability Score:  {self.stability_score * 100:.1f}%")
        print()

        # Latency
        print("LATENCY METRICS")
        print("-" * 40)
        print(f"  Average:  {self.avg_latency_ms:.0f} ms")
        print(f"  P50:      {self.p50_latency_ms:.0f} ms")
        print(f"  P95:      {self.p95_latency_ms:.0f} ms")
        print(f"  P99:      {self.p99_latency_ms:.0f} ms")
        print()

        # Cost
        print("COST METRICS")
        print("-" * 40)
        print(f"  Total Tokens: {self.total_tokens:,}")
        print(f"  Total Cost:   ${self.total_cost_usd:.4f}")
        print()

        # Pass@K
        print("PASS@K METRICS")
        print("-" * 40)
        for k, v in self.pass_at_k.items():
            print(f"  pass@{k}: {v * 100:.1f}%")
        print()

        # Category Breakdown
        print("CATEGORY BREAKDOWN")
        print("-" * 40)
        print(f"{'Category':<25} {'Accuracy':>10} {'Tool Sel.':>10} {'Latency':>10}")
        print("-" * 55)
        for cat, m in self.category_metrics.items():
            cat_display = cat.replace("_", " ").title()[:24]
            print(f"{cat_display:<25} {m.accuracy * 100:>9.1f}% {m.tool_selection_accuracy * 100:>9.1f}% {m.avg_latency_ms:>8.0f}ms")
        print()

        # Tool Accuracy
        print("TOOL SELECTION ACCURACY")
        print("-" * 40)
        sorted_tools = sorted(self.tool_accuracy_by_tool.items(), key=lambda x: x[1], reverse=True)
        for tool, acc in sorted_tools[:10]:  # Top 10
            print(f"  {tool:<25} {acc * 100:.1f}%")
        print()

        print("=" * 70)


class MetricsCalculator:
    """Calculate evaluation metrics from test results"""

    # Pricing estimates (per 1M tokens, approximate)
    PRICING = {
        "gemini-2.0-flash": {"input": 0.075, "output": 0.30},
        "gemini-2.5-pro": {"input": 1.25, "output": 5.00},
        "default": {"input": 0.10, "output": 0.40},
    }

    @staticmethod
    def calculate_tool_accuracy(results: List[TestResult]) -> Dict[str, float]:
        """Calculate accuracy for each tool"""
        tool_stats: Dict[str, Dict[str, int]] = {}

        for result in results:
            expected_set = set(result.expected_tools)
            actual_set = set(result.actual_tools)

            for tool in expected_set | actual_set:
                if tool not in tool_stats:
                    tool_stats[tool] = {"correct": 0, "total": 0}

                # Tool was expected
                if tool in expected_set:
                    tool_stats[tool]["total"] += 1
                    if tool in actual_set:
                        tool_stats[tool]["correct"] += 1

        return {
            tool: stats["correct"] / stats["total"] if stats["total"] > 0 else 0.0
            for tool, stats in tool_stats.items()
        }

    @staticmethod
    def calculate_category_metrics(
        results: List[TestResult], category: str
    ) -> CategoryMetrics:
        """Calculate metrics for a specific category"""
        category_results = [r for r in results if r.category == category]

        if not category_results:
            return CategoryMetrics(
                category=category,
                total_tests=0,
                passed_tests=0,
                accuracy=0.0,
                avg_latency_ms=0.0,
                p95_latency_ms=0.0,
                total_tokens=0,
                total_cost_usd=0.0,
                tool_selection_accuracy=0.0,
                false_positive_rate=0.0,
                false_negative_rate=0.0,
            )

        total = len(category_results)
        passed = sum(1 for r in category_results if r.passed)
        latencies = [r.latency_ms for r in category_results]

        # Tool selection metrics
        correct_tool_selections = 0
        false_positives = 0
        false_negatives = 0
        total_expected = 0
        total_actual = 0

        for result in category_results:
            expected_set = set(result.expected_tools)
            actual_set = set(result.actual_tools)

            # Correct if sets match exactly
            if expected_set == actual_set:
                correct_tool_selections += 1

            total_expected += len(expected_set)
            total_actual += len(actual_set)
            false_positives += len(actual_set - expected_set)
            false_negatives += len(expected_set - actual_set)

        return CategoryMetrics(
            category=category,
            total_tests=total,
            passed_tests=passed,
            accuracy=passed / total,
            avg_latency_ms=statistics.mean(latencies) if latencies else 0.0,
            p95_latency_ms=MetricsCalculator._percentile(latencies, 95) if latencies else 0.0,
            total_tokens=sum(r.tokens_used for r in category_results),
            total_cost_usd=sum(r.cost_usd for r in category_results),
            tool_selection_accuracy=correct_tool_selections / total,
            false_positive_rate=false_positives / max(total_actual, 1),
            false_negative_rate=false_negatives / max(total_expected, 1),
        )

    @staticmethod
    def calculate_pass_at_k(results: List[TestResult], k_values: List[int] = [1, 3, 5]) -> Dict[int, float]:
        """
        Calculate pass@k metric (probability of at least one correct in k attempts)

        For single-attempt evaluations, this is simplified to success rate.
        In production, you'd run each test k times and measure.
        """
        # For now, pass@1 = accuracy, pass@k estimated from variance
        total = len(results)
        passed = sum(1 for r in results if r.passed)
        base_rate = passed / total if total > 0 else 0.0

        pass_at_k = {}
        for k in k_values:
            # Simplified: pass@k = 1 - (1 - base_rate)^k
            # This assumes independent attempts
            pass_at_k[k] = 1 - ((1 - base_rate) ** k)

        return pass_at_k

    @staticmethod
    def calculate_stability_score(results: List[TestResult]) -> float:
        """
        Calculate stability score based on consistency of results.

        Measures how consistently the agent performs across similar test cases.
        """
        # Group by tags and measure variance within groups
        tag_results: Dict[str, List[bool]] = {}

        for result in results:
            for tag in result.metadata.get("tags", []):
                if tag not in tag_results:
                    tag_results[tag] = []
                tag_results[tag].append(result.passed)

        if not tag_results:
            return 1.0  # Perfect stability if no tags

        # Calculate variance per tag group
        variances = []
        for tag, passed_list in tag_results.items():
            if len(passed_list) >= 2:
                # Variance of binary outcomes
                p = sum(passed_list) / len(passed_list)
                variance = p * (1 - p)
                variances.append(1 - variance)  # Convert to stability

        return statistics.mean(variances) if variances else 1.0

    @staticmethod
    def _percentile(data: List[float], percentile: int) -> float:
        """Calculate percentile of data"""
        if not data:
            return 0.0
        sorted_data = sorted(data)
        index = (percentile / 100) * (len(sorted_data) - 1)
        lower = int(index)
        upper = lower + 1
        if upper >= len(sorted_data):
            return sorted_data[-1]
        weight = index - lower
        return sorted_data[lower] * (1 - weight) + sorted_data[upper] * weight

    @classmethod
    def calculate_all_metrics(
        cls,
        results: List[TestResult],
        suite_name: str
    ) -> EvaluationMetrics:
        """Calculate all evaluation metrics from test results"""
        if not results:
            return EvaluationMetrics(
                timestamp=datetime.now().isoformat(),
                suite_name=suite_name,
                total_tests=0,
                passed_tests=0,
                overall_accuracy=0.0,
                category_metrics={},
                tool_accuracy_by_tool={},
                avg_latency_ms=0.0,
                p50_latency_ms=0.0,
                p95_latency_ms=0.0,
                p99_latency_ms=0.0,
                total_tokens=0,
                total_cost_usd=0.0,
                pass_at_k={1: 0.0, 3: 0.0, 5: 0.0},
                stability_score=0.0,
                individual_results=results,
            )

        # Basic counts
        total = len(results)
        passed = sum(1 for r in results if r.passed)
        latencies = [r.latency_ms for r in results]

        # Category metrics
        categories = set(r.category for r in results)
        category_metrics = {
            cat: cls.calculate_category_metrics(results, cat)
            for cat in categories
        }

        return EvaluationMetrics(
            timestamp=datetime.now().isoformat(),
            suite_name=suite_name,
            total_tests=total,
            passed_tests=passed,
            overall_accuracy=passed / total,
            category_metrics=category_metrics,
            tool_accuracy_by_tool=cls.calculate_tool_accuracy(results),
            avg_latency_ms=statistics.mean(latencies) if latencies else 0.0,
            p50_latency_ms=cls._percentile(latencies, 50) if latencies else 0.0,
            p95_latency_ms=cls._percentile(latencies, 95) if latencies else 0.0,
            p99_latency_ms=cls._percentile(latencies, 99) if latencies else 0.0,
            total_tokens=sum(r.tokens_used for r in results),
            total_cost_usd=sum(r.cost_usd for r in results),
            pass_at_k=cls.calculate_pass_at_k(results),
            stability_score=cls.calculate_stability_score(results),
            individual_results=results,
        )
