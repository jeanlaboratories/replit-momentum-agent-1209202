import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandSoulExplainability } from '../brand-soul-explainability';

describe('BrandSoulExplainability', () => {
  // Note: confidence is expected as 0-1 decimal, component multiplies by 100 for display
  const mockExplainability = {
    summary: 'Test summary for brand soul',
    confidence: 0.85,  // 85%
    appliedControls: ['Control 1', 'Control 2'],
    brandElements: ['Element 1'],
    avoidedElements: ['Avoided 1'],
  };

  it('should render the component with basic props', () => {
    render(<BrandSoulExplainability explainability={mockExplainability} />);

    expect(screen.getByText('Team Intelligence Influence')).toBeInTheDocument();
    expect(screen.getByText('Test summary for brand soul')).toBeInTheDocument();
  });

  describe('Float formatting for confidence', () => {
    it('should display confidence as a rounded integer percentage', () => {
      render(<BrandSoulExplainability explainability={mockExplainability} />);

      // 0.85 * 100 = 85, should display "85% confidence"
      expect(screen.getByText('85% confidence')).toBeInTheDocument();
    });

    it('should round decimal confidence values to integers', () => {
      const explainabilityWithDecimal = {
        ...mockExplainability,
        confidence: 0.7333333333,  // Would be 73.33333% without rounding
      };

      render(<BrandSoulExplainability explainability={explainabilityWithDecimal} />);

      // Math.round(0.7333333333 * 100) = 73
      expect(screen.getByText('73% confidence')).toBeInTheDocument();
    });

    it('should round up when decimal is >= 0.5', () => {
      const explainabilityWithDecimal = {
        ...mockExplainability,
        confidence: 0.735,  // 73.5%
      };

      render(<BrandSoulExplainability explainability={explainabilityWithDecimal} />);

      // Math.round(0.735 * 100) = Math.round(73.5) = 74
      expect(screen.getByText('74% confidence')).toBeInTheDocument();
    });

    it('should round down when decimal is < 0.5', () => {
      const explainabilityWithDecimal = {
        ...mockExplainability,
        confidence: 0.734,  // 73.4%
      };

      render(<BrandSoulExplainability explainability={explainabilityWithDecimal} />);

      // Math.round(0.734 * 100) = Math.round(73.4) = 73
      expect(screen.getByText('73% confidence')).toBeInTheDocument();
    });

    it('should never display long decimal numbers like 0.13333333333333333', () => {
      const explainabilityWithLongDecimal = {
        ...mockExplainability,
        confidence: 0.13333333333333333,  // ~13.33%
      };

      render(<BrandSoulExplainability explainability={explainabilityWithLongDecimal} />);

      // Should NOT contain any long decimal in the display
      const container = screen.getByText('Team Intelligence Influence').closest('div')?.parentElement;
      expect(container?.textContent).not.toContain('13.333333');

      // Should display rounded value: Math.round(0.13333... * 100) = 13
      expect(screen.getByText('13% confidence')).toBeInTheDocument();
    });
  });

  describe('Confidence color coding', () => {
    it('should apply green color for high confidence (>= 0.8)', () => {
      render(<BrandSoulExplainability explainability={{ ...mockExplainability, confidence: 0.85 }} />);

      const badge = screen.getByText('85% confidence');
      expect(badge.className).toContain('text-emerald-500');
    });

    it('should apply yellow color for medium confidence (>= 0.6, < 0.8)', () => {
      render(<BrandSoulExplainability explainability={{ ...mockExplainability, confidence: 0.65 }} />);

      const badge = screen.getByText('65% confidence');
      expect(badge.className).toContain('text-yellow-500');
    });

    it('should apply orange color for low confidence (< 0.6)', () => {
      render(<BrandSoulExplainability explainability={{ ...mockExplainability, confidence: 0.45 }} />);

      const badge = screen.getByText('45% confidence');
      expect(badge.className).toContain('text-orange-500');
    });
  });
});
