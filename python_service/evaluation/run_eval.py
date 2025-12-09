#!/usr/bin/env python3
"""
Simple script to run MOMENTUM agent evaluation.

Usage:
    python -m evaluation.run_eval --quick          # Quick test (6 tests)
    python -m evaluation.run_eval --core           # Core test (50 tests, no video)
    python -m evaluation.run_eval --extended       # Extended test (100 tests, no video)
    python -m evaluation.run_eval --full-no-video  # Full without video (180+ tests)
    python -m evaluation.run_eval                  # Full evaluation (220+ tests)
    python -m evaluation.run_eval --url https://...  # Against remote
"""

import asyncio
import sys
import os

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evaluation.benchmark_runner import MomentumBenchmarkRunner, BenchmarkConfig
from evaluation.test_cases import (
    get_momentum_test_suite,
    get_quick_test_suite,
    get_core_test_suite,
    get_extended_core_suite,
    get_full_no_video_suite,
)


async def main():
    import argparse

    parser = argparse.ArgumentParser(description="MOMENTUM Agent Evaluation")
    parser.add_argument("--url", default="http://localhost:8001", help="Agent API URL")
    parser.add_argument("--quick", action="store_true", help="Run quick test suite (6 tests)")
    parser.add_argument("--core", action="store_true", help="Run core test suite (50 tests, no video)")
    parser.add_argument("--extended", action="store_true", help="Run extended core suite (100 tests, no video)")
    parser.add_argument("--full-no-video", action="store_true", help="Run full suite without video (180+ tests)")
    parser.add_argument("--output", "-o", default="evaluation_results.json", help="Output JSON file path")

    args = parser.parse_args()

    # Select test suite
    if args.quick:
        suite = get_quick_test_suite()
        mode = "Quick (6 tests)"
    elif args.core:
        suite = get_core_test_suite()
        mode = "Core (50 tests)"
    elif args.extended:
        suite = get_extended_core_suite()
        mode = "Extended (100 tests)"
    elif args.full_no_video:
        suite = get_full_no_video_suite()
        mode = "Full No-Video (180+ tests)"
    else:
        suite = get_momentum_test_suite()
        mode = "Full (220+ tests)"

    print(f"Running MOMENTUM Agent Evaluation")
    print(f"URL: {args.url}")
    print(f"Mode: {mode}")
    print()

    config = BenchmarkConfig(base_url=args.url)

    async with MomentumBenchmarkRunner(config) as runner:
        metrics = await runner.run_test_suite(suite=suite)

    # Print summary
    metrics.print_summary()

    # Save results
    if args.output:
        with open(args.output, 'w') as f:
            f.write(metrics.to_json())
        print(f"\nResults saved to: {args.output}")

    # Return exit code based on pass rate
    pass_rate = metrics.overall_accuracy
    if pass_rate >= 0.8:
        print(f"\n✓ Evaluation PASSED ({pass_rate*100:.1f}% accuracy)")
        return 0
    else:
        print(f"\n✗ Evaluation FAILED ({pass_rate*100:.1f}% accuracy)")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
