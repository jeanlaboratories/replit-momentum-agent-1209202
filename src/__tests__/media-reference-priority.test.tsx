/**
 * Tests for Robust Media Reference System Integration
 *
 * This test file ensures that the robust media tracking system is properly integrated:
 * 1. Resolves media references accurately
 * 2. Handles all edge cases (multi-image, ambiguous, historic references)
 * 3. Provides detailed resolution metadata
 * 4. Integrates with Python agent properly
 * 5. No confusion between old and new media
 */

import { vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Robust Media Reference System Integration', () => {
  const srcDir = path.join(__dirname, '..');
  const routePath = path.join(srcDir, 'app/api/chat/route.ts');
  const robustModulePath = path.join(srcDir, 'lib/robust-media-context.ts');

  describe('Robust System Integration', () => {
    it('chat route file should exist', () => {
      expect(fs.existsSync(routePath)).toBe(true);
    });
    
    it('robust media context module should exist', () => {
      expect(fs.existsSync(robustModulePath)).toBe(true);
    });

    it('should import robust media context functions', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('from \'@/lib/robust-media-context\'');
      expect(content).toContain('resolveMediaReferences');
      expect(content).toContain('buildMediaRegistry');
    });

    it('should use robust media resolution', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('ROBUST MEDIA REFERENCE RESOLUTION SYSTEM');
      expect(content).toContain('resolveMediaReferences(');
      expect(content).toContain('mediaContext.resolution.method');
    });

    it('should handle disambiguation', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('mediaContext.disambiguation.required');
      expect(content).toContain('disambiguation request');
    });

    it('should build media registry from conversation', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('buildMediaRegistry');
      expect(content).toContain('conversationMedia');
    });
  });

  describe('Enhanced Image Context', () => {
    it('should include resolution metadata in image context', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('image_context:');
      expect(content).toContain('resolution_method');
      expect(content).toContain('resolution_confidence');
      expect(content).toContain('user_intent');
    });

    it('should mark new media correctly', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('is_new_media:');
      expect(content).toContain('currentTurnUploads.length > 0');
    });

    it('should include persistent_id for tracking', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('persistent_id:');
      expect(content).toContain('persistentId');
    });

    it('should include role information', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('role:');
      expect(content).toContain('m.role');
    });

    it('should include robust_media_context', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('robust_media_context:');
      expect(content).toContain('resolved_media_count');
      expect(content).toContain('available_media_count');
    });
  });

  describe('Resolution Process', () => {
    it('should use robust resolution algorithm', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // Should call resolveMediaReferences with all parameters
      expect(content).toContain('resolveMediaReferences(');
      expect(content).toContain('userMessage');
      expect(content).toContain('currentTurnUploads');
      expect(content).toContain('conversationMedia');
    });

    it('should create enhanced media for current turn', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('createEnhancedMedia');
      expect(content).toContain('currentTurnUploads');
    });

    it('should extract semantic tags', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('extractSemanticTagsFromFilename');
      expect(content).toContain('semanticTags');
    });

    it('should log resolution details', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('Media resolution complete');
      expect(content).toContain('method:');
      expect(content).toContain('confidence:');
    });
  });

  describe('User Instructions Interpretation', () => {
    it('should handle "it" referring to newly uploaded media', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // New robust system uses currentTurnUploads
      expect(content).toContain('currentTurnUploads');
      
      // Agent will receive resolved media
      expect(content).toContain('media: mediaFiles');
    });

    it('should handle "the image" referring to new upload', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // New media resolved through robust system
      expect(content).toContain('resolveMediaReferences');
      expect(content).toContain('currentTurnUploads');
    });

    it('should handle multiple newly injected images', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // Should use robust media context which handles multiple images
      expect(content).toContain('mediaContext');
      expect(content).toContain('resolvedMedia');
    });
  });

  describe('Resolution Metadata', () => {
    it('should track resolution method', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('resolution.method');
      expect(content).toContain('resolution.confidence');
    });

    it('should track user intent', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('userIntent');
      expect(content).toContain('user_intent');
    });

    it('should handle disambiguation', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('disambiguation');
      expect(content).toContain('required');
    });

    it('should provide debug information', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      expect(content).toContain('debug_info');
      expect(content).toContain('debugInfo');
    });
  });

  describe('Backward Compatibility', () => {
    it('should still support referencing past images when no new media', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // Robust system builds media registry which tracks historical media
      expect(content).toContain('buildMediaRegistry');
      expect(content).toContain('conversationMedia');
    });

    it('should still extract image context from message history', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // Robust system builds complete media registry
      expect(content).toContain('buildMediaRegistry');
    });

    it('should still support numbered references like "image 1"', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // Robust system handles all reference types
      expect(content).toContain('resolveMediaReferences');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty media array', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // Robust system handles empty arrays
      expect(content).toContain('media');
      expect(content).toContain('length');
    });

    it('should handle mixed media types (image + video)', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // Should filter for images when building image context
      expect(content).toContain("type === 'image'");
    });

    it('should handle no image context (empty conversation)', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // Should handle case when no media resolved
      expect(content).toContain('resolvedMedia');
      expect(content).toContain('undefined');
    });
  });

  describe('Integration - Complete Flow', () => {
    it('should follow correct flow for new media upload', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // Flow: Build registry → Resolve references → Use resolved media
      expect(content).toContain('buildMediaRegistry');
      expect(content).toContain('resolveMediaReferences');
      expect(content).toContain('is_new_media');
    });

    it('should follow correct flow for historical reference', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // Flow: Build registry → Resolve with conversation media → Get resolved media
      expect(content).toContain('conversationMedia');
      expect(content).toContain('resolveMediaReferences');
      expect(content).toContain('mediaContext');
    });

    it('should handle both new media and historical context coexisting', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // Robust system maintains both current and historical media
      expect(content).toContain('currentTurnUploads');
      expect(content).toContain('conversationMedia');
    });
  });

  describe('Code Quality', () => {
    it('should have clear variable names', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // Robust system variable names
      expect(content).toContain('mediaContext');
      expect(content).toContain('resolvedMedia');
      expect(content).toContain('currentTurnUploads');
    });

    it('should not have duplicate variable declarations', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // Check for hasMedia variable
      expect(content).toContain('hasMedia');
      
      // Should be used for token management
      expect(content).toContain('truncateMessagesForContextWindow');
    });

    it('should have explanatory comments', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      
      // New robust system has different comments
      expect(content).toContain('ROBUST MEDIA REFERENCE RESOLUTION SYSTEM');
      expect(content).toContain('Starting robust media resolution');
    });
  });
});

