import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { VisionAnalysisPanel } from '../VisionAnalysisPanel';
import type { UnifiedMedia } from '@/lib/types/media-library';

// Mock the UI components
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: any) => (
    <span className={`badge ${className || ''} ${variant || ''}`}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Eye: ({ className }: any) => <div className={className} data-testid="eye-icon">👁️</div>,
  Sparkles: ({ className }: any) => <div className={className} data-testid="sparkles-icon">✨</div>,
  Tag: ({ className }: any) => <div className={className} data-testid="tag-icon">🏷️</div>,
  Target: ({ className }: any) => <div className={className} data-testid="target-icon">🎯</div>,
}));

describe('VisionAnalysisPanel', () => {
  const createMockMedia = (overrides?: Partial<UnifiedMedia & {
    visionDescription?: string;
    visionKeywords?: string[];
    visionCategories?: string[];
    enhancedSearchText?: string;
  }>): UnifiedMedia => ({
    id: 'test-media-1',
    brandId: 'test-brand',
    type: 'image',
    url: 'https://example.com/test-image.jpg',
    thumbnailUrl: 'https://example.com/test-thumb.jpg',
    title: 'Test Image',
    description: 'A test image',
    tags: ['test'],
    collections: [],
    source: 'upload',
    createdAt: new Date().toISOString(),
    createdBy: 'user123',
    ...overrides,
  });

  describe('when no vision data is available', () => {
    it('should show no analysis message for image without vision data', () => {
      const media = createMockMedia();
      
      render(<VisionAnalysisPanel media={media} />);
      
      expect(screen.getByText('No AI vision analysis available')).toBeInTheDocument();
      expect(screen.getByText('Run AI Vision Analysis to enhance search capabilities')).toBeInTheDocument();
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
    });

    it('should show no analysis message when vision data is empty', () => {
      const media = createMockMedia({
        visionDescription: '',
        visionKeywords: [],
        visionCategories: [],
      });
      
      render(<VisionAnalysisPanel media={media} />);
      
      expect(screen.getByText('No AI vision analysis available')).toBeInTheDocument();
    });
  });

  describe('when vision data is available', () => {
    const mockMediaWithVision = createMockMedia({
      visionDescription: 'A red sports car parked in front of a modern glass building on a sunny day.',
      visionKeywords: [
        'red car',
        'sports car',
        'vehicle',
        'automobile',
        'glass building',
        'modern architecture',
        'sunny day',
        'parking',
      ],
      visionCategories: ['transportation', 'automotive', 'architecture'],
      enhancedSearchText: 'red sports car vehicle automobile glass building modern architecture sunny day parking transportation automotive architecture',
    });

    it('should display the AI Vision Analysis header', () => {
      render(<VisionAnalysisPanel media={mockMediaWithVision} />);
      
      expect(screen.getByText('AI Vision Analysis')).toBeInTheDocument();
      expect(screen.getByTestId('sparkles-icon')).toBeInTheDocument();
    });

    it('should display the vision description', () => {
      render(<VisionAnalysisPanel media={mockMediaWithVision} />);
      
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('A red sports car parked in front of a modern glass building on a sunny day.')).toBeInTheDocument();
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
    });

    it('should display vision keywords as badges', () => {
      render(<VisionAnalysisPanel media={mockMediaWithVision} />);
      
      expect(screen.getByText('Keywords (8)')).toBeInTheDocument();
      expect(screen.getByTestId('tag-icon')).toBeInTheDocument();
      
      // Check that keywords are displayed as badges
      expect(screen.getByText('red car')).toBeInTheDocument();
      expect(screen.getByText('sports car')).toBeInTheDocument();
      expect(screen.getByText('glass building')).toBeInTheDocument();
      expect(screen.getByText('modern architecture')).toBeInTheDocument();
      
      // Check badge count matches keywords length - use more specific selectors
      expect(screen.getByText('red car')).toBeInTheDocument();
      expect(screen.getByText('sports car')).toBeInTheDocument();
      expect(screen.getByText('vehicle')).toBeInTheDocument();
      expect(screen.getByText('automobile')).toBeInTheDocument();
    });

    it('should display vision categories as badges', () => {
      render(<VisionAnalysisPanel media={mockMediaWithVision} />);
      
      expect(screen.getByText('Categories')).toBeInTheDocument();
      expect(screen.getByTestId('target-icon')).toBeInTheDocument();
      
      // Check that categories are displayed
      expect(screen.getByText('transportation')).toBeInTheDocument();
      expect(screen.getByText('automotive')).toBeInTheDocument();
      expect(screen.getByText('architecture')).toBeInTheDocument();
    });

    it('should display separators between sections', () => {
      render(<VisionAnalysisPanel media={mockMediaWithVision} />);
      
      const separators = screen.getAllByTestId('separator');
      expect(separators).toHaveLength(2); // Between description/keywords and keywords/categories
    });

    it('should display the enhancement message', () => {
      render(<VisionAnalysisPanel media={mockMediaWithVision} />);
      
      expect(screen.getByText('✨ This analysis enhances search accuracy by understanding visual content')).toBeInTheDocument();
    });
  });

  describe('partial vision data scenarios', () => {
    it('should display only description when keywords and categories are missing', () => {
      const media = createMockMedia({
        visionDescription: 'A beautiful landscape photo.',
        visionKeywords: [],
        visionCategories: [],
      });
      
      render(<VisionAnalysisPanel media={media} />);
      
      expect(screen.getByText('AI Vision Analysis')).toBeInTheDocument();
      expect(screen.getByText('A beautiful landscape photo.')).toBeInTheDocument();
      
      // Should not show keywords or categories sections
      expect(screen.queryByText(/Keywords/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Categories/)).not.toBeInTheDocument();
    });

    it('should display only keywords when description and categories are missing', () => {
      const media = createMockMedia({
        visionDescription: '',
        visionKeywords: ['landscape', 'nature', 'outdoor'],
        visionCategories: [],
      });
      
      render(<VisionAnalysisPanel media={media} />);
      
      expect(screen.getByText('AI Vision Analysis')).toBeInTheDocument();
      expect(screen.getByText('Keywords (3)')).toBeInTheDocument();
      expect(screen.getByText('landscape')).toBeInTheDocument();
      
      // Should not show description or categories sections
      expect(screen.queryByText('Description')).not.toBeInTheDocument();
      expect(screen.queryByText(/Categories/)).not.toBeInTheDocument();
    });

    it('should display only categories when description and keywords are missing', () => {
      const media = createMockMedia({
        visionDescription: '',
        visionKeywords: [],
        visionCategories: ['nature', 'landscape'],
      });
      
      render(<VisionAnalysisPanel media={media} />);
      
      expect(screen.getByText('AI Vision Analysis')).toBeInTheDocument();
      expect(screen.getByText('Categories')).toBeInTheDocument();
      expect(screen.getByText('nature')).toBeInTheDocument();
      expect(screen.getByText('landscape')).toBeInTheDocument();
      
      // Should not show description or keywords sections
      expect(screen.queryByText('Description')).not.toBeInTheDocument();
      expect(screen.queryByText(/Keywords/)).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle empty keywords array gracefully', () => {
      const media = createMockMedia({
        visionDescription: 'Test description',
        visionKeywords: undefined, // Undefined instead of empty array
        visionCategories: ['test'],
      });
      
      render(<VisionAnalysisPanel media={media} />);
      
      expect(screen.getByText('Test description')).toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument();
      expect(screen.queryByText(/Keywords/)).not.toBeInTheDocument();
    });

    it('should handle undefined vision data gracefully', () => {
      const media = createMockMedia({
        visionDescription: undefined,
        visionKeywords: undefined,
        visionCategories: undefined,
      });
      
      render(<VisionAnalysisPanel media={media} />);
      
      expect(screen.getByText('No AI vision analysis available')).toBeInTheDocument();
    });

    it('should handle very long descriptions', () => {
      const longDescription = 'A'.repeat(500) + ' very long description that should still render properly';
      const media = createMockMedia({
        visionDescription: longDescription,
      });
      
      render(<VisionAnalysisPanel media={media} />);
      
      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it('should handle many keywords without breaking layout', () => {
      const manyKeywords = Array.from({ length: 50 }, (_, i) => `keyword${i}`);
      const media = createMockMedia({
        visionDescription: 'Test description',
        visionKeywords: manyKeywords,
      });
      
      render(<VisionAnalysisPanel media={media} />);
      
      expect(screen.getByText('Keywords (50)')).toBeInTheDocument();
      expect(screen.getByText('keyword0')).toBeInTheDocument();
      expect(screen.getByText('keyword49')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper semantic structure', () => {
      const media = createMockMedia({
        visionDescription: 'Test description',
        visionKeywords: ['test'],
        visionCategories: ['category'],
      });
      
      render(<VisionAnalysisPanel media={media} />);
      
      // Check that section headers are present
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Keywords (1)')).toBeInTheDocument();
      expect(screen.getByText('Categories')).toBeInTheDocument();
      
      // Check that icons are present for visual context
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
      expect(screen.getByTestId('tag-icon')).toBeInTheDocument();
      expect(screen.getByTestId('target-icon')).toBeInTheDocument();
    });

    it('should handle special characters in vision data', () => {
      const media = createMockMedia({
        visionDescription: 'A café with "special" characters & symbols!',
        visionKeywords: ['café', '"quotes"', 'symbols&stuff'],
        visionCategories: ['food & drink'],
      });
      
      render(<VisionAnalysisPanel media={media} />);
      
      expect(screen.getByText('A café with "special" characters & symbols!')).toBeInTheDocument();
      expect(screen.getByText('café')).toBeInTheDocument();
      expect(screen.getByText('"quotes"')).toBeInTheDocument();
      expect(screen.getByText('food & drink')).toBeInTheDocument();
    });
  });
});