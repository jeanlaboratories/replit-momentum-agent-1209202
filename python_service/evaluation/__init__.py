"""
MOMENTUM Agent Evaluation Suite

A comprehensive evaluation framework for testing the MOMENTUM agent across:
1. Tool Selection Accuracy - Does the agent choose the right tool?
2. Memory Persistence - Does the agent remember facts across turns?
3. Context Flow - Is context preserved across tool transitions?
4. Multi-Modal Generation - Quality of text, image, video outputs
5. Brand Consistency - Does output align with Brand Soul guidelines?

Inspired by benchmarks: BFCL, AgentBench, GAIA, LOCOMO, CLASSic
"""

from .benchmark_runner import MomentumBenchmarkRunner
from .test_cases import TestCase, TestSuite
from .metrics import EvaluationMetrics

__all__ = ['MomentumBenchmarkRunner', 'TestCase', 'TestSuite', 'EvaluationMetrics']
