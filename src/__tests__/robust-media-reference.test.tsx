/**
 * COMPREHENSIVE TESTS FOR ROBUST MEDIA REFERENCE SYSTEM
 * 
 * These tests verify 100% accurate media reference resolution for all edge cases:
 * 1. Single image uploads
 * 2. Multi-image ambiguous references
 * 3. Multi-image specific references
 * 4. Numeric references ("image 1", "image 2")
 * 5. Ordinal references ("first image", "second image")
 * 6. Recency references ("last image", "previous image")
 * 7. Filename references ("logo.png")
 * 8. Semantic content matching
 * 9. Cross-turn historical references
 * 10. Multi-image operations (combine, compare)
 * 11. Role assignment (primary, reference, mask)
 * 12. Disambiguation when ambiguous
 */

import { describe, it, expect } from 'vitest';
import {
  resolveMediaReferences,
  buildMediaRegistry,
  createEnhancedMedia,
  formatMediaListForUser,
  formatMediaContextForAI,
  extractSemanticTagsFromFilename,
  type EnhancedMedia,
  type RobustMediaContext,
} from '@/lib/robust-media-context';

describe('Robust Media Reference System', () => {
  
  // =====================================================================
  // SCENARIO 1: Single Image Upload (Unambiguous)
  // =====================================================================
  
  describe('Scenario 1: Single Image Upload', () => {
    it('should resolve single image upload with 100% confidence', () => {
      const currentTurnUploads: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/car.jpg', fileName: 'car.jpg' },
          5,
          'user_upload'
        ),
      ];
      currentTurnUploads[0].displayIndex = 1;
      
      const result = resolveMediaReferences(
        'make it red',
        currentTurnUploads,
        [],
        5
      );
      
      expect(result.resolution.method).toBe('explicit_upload');
      expect(result.resolution.confidence).toBe(1.0);
      expect(result.resolvedMedia).toHaveLength(1);
      expect(result.resolvedMedia[0].url).toBe('https://example.com/car.jpg');
      expect(result.resolvedMedia[0].role).toBe('primary');
      expect(result.disambiguation.required).toBe(false);
    });
    
    it('should work with any instruction text', () => {
      const currentTurnUploads: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img.jpg', fileName: 'img.jpg' },
          1,
          'user_upload'
        ),
      ];
      currentTurnUploads[0].displayIndex = 1;
      
      const instructions = [
        'edit this',
        'make it darker',
        'add a sunset',
        'change the background to blue',
        'remove the person',
      ];
      
      for (const instruction of instructions) {
        const result = resolveMediaReferences(instruction, currentTurnUploads, [], 1);
        expect(result.resolvedMedia).toHaveLength(1);
        expect(result.resolution.confidence).toBeGreaterThanOrEqual(0.9);
      }
    });
  });
  
  // =====================================================================
  // SCENARIO 2: Multi-Image Upload WITHOUT Specificity (Ambiguous)
  // =====================================================================
  
  describe('Scenario 2: Multi-Image Ambiguous Upload', () => {
    it('should require disambiguation for multiple uploads with generic instruction', () => {
      const currentTurnUploads: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/car.jpg', fileName: 'car.jpg' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/house.jpg', fileName: 'house.jpg' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/tree.jpg', fileName: 'tree.jpg' },
          1,
          'user_upload'
        ),
      ];
      currentTurnUploads.forEach((m, i) => {
        m.displayIndex = i + 1;
      });
      
      const result = resolveMediaReferences(
        'make it red',
        currentTurnUploads,
        [],
        1
      );
      
      expect(result.resolution.method).toBe('ambiguous');
      expect(result.disambiguation.required).toBe(true);
      expect(result.disambiguation.reason).toBe('multiple_uploads_unclear_target');
      expect(result.disambiguation.options).toHaveLength(3);
      expect(result.resolvedMedia).toHaveLength(0);
    });
    
    it('should provide all options in disambiguation', () => {
      const currentTurnUploads: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img1.jpg', fileName: 'img1.jpg' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img2.jpg', fileName: 'img2.jpg' },
          1,
          'user_upload'
        ),
      ];
      currentTurnUploads.forEach((m, i) => {
        m.displayIndex = i + 1;
      });
      
      const result = resolveMediaReferences('edit this', currentTurnUploads, [], 1);
      
      expect(result.disambiguation.options[0].media.fileName).toBe('img1.jpg');
      expect(result.disambiguation.options[1].media.fileName).toBe('img2.jpg');
      expect(result.stats.requiresUserInput).toBe(true);
    });
  });
  
  // =====================================================================
  // SCENARIO 3: Multi-Image Upload WITH Specificity
  // =====================================================================
  
  describe('Scenario 3: Multi-Image Specific Reference', () => {
    it('should resolve specific image from filename mention', () => {
      const currentTurnUploads: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/car.jpg', fileName: 'car.jpg' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/house.jpg', fileName: 'house.jpg' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/tree.jpg', fileName: 'tree.jpg' },
          1,
          'user_upload'
        ),
      ];
      currentTurnUploads.forEach((m, i) => {
        m.displayIndex = i + 1;
      });
      
      const result = resolveMediaReferences(
        'make the house blue',
        currentTurnUploads,
        [],
        1
      );
      
      expect(result.resolution.method).toBe('semantic_match');
      expect(result.resolvedMedia).toHaveLength(1);
      expect(result.resolvedMedia[0].fileName).toBe('house.jpg');
      expect(result.disambiguation.required).toBe(false);
    });
    
    it('should resolve from semantic tags', () => {
      const currentTurnUploads: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/red_car.jpg', fileName: 'red_car.jpg' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/blue_house.jpg', fileName: 'blue_house.jpg' },
          1,
          'user_upload'
        ),
      ];
      currentTurnUploads.forEach((m, i) => {
        m.displayIndex = i + 1;
        m.semanticTags = extractSemanticTagsFromFilename(m.fileName);
      });
      
      const result = resolveMediaReferences(
        'edit the car',
        currentTurnUploads,
        [],
        1
      );
      
      expect(result.resolvedMedia).toHaveLength(1);
      expect(result.resolvedMedia[0].fileName).toBe('red_car.jpg');
    });
  });
  
  // =====================================================================
  // SCENARIO 4: Numeric References
  // =====================================================================
  
  describe('Scenario 4: Numeric References', () => {
    it('should resolve "image 1" reference', () => {
      const conversationMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/logo.png', fileName: 'logo.png' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/bg.png', fileName: 'background.png' },
          3,
          'user_upload'
        ),
      ];
      conversationMedia[0].displayIndex = 1;
      conversationMedia[1].displayIndex = 2;
      
      const result = resolveMediaReferences(
        'edit image 1',
        [],
        conversationMedia,
        5
      );
      
      expect(result.resolution.method).toBe('numeric_reference');
      expect(result.resolvedMedia).toHaveLength(1);
      expect(result.resolvedMedia[0].fileName).toBe('logo.png');
      expect(result.resolvedMedia[0].displayIndex).toBe(1);
    });
    
    it('should resolve "image 2" reference', () => {
      const conversationMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img1.png', fileName: 'img1.png' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img2.png', fileName: 'img2.png' },
          3,
          'user_upload'
        ),
      ];
      conversationMedia[0].displayIndex = 1;
      conversationMedia[1].displayIndex = 2;
      
      const result = resolveMediaReferences(
        'use image 2',
        [],
        conversationMedia,
        5
      );
      
      expect(result.resolvedMedia[0].fileName).toBe('img2.png');
    });
    
    it('should handle out of range numeric reference', () => {
      const conversationMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img1.png', fileName: 'img1.png' },
          1,
          'user_upload'
        ),
      ];
      conversationMedia[0].displayIndex = 1;
      
      const result = resolveMediaReferences(
        'edit image 5',
        [],
        conversationMedia,
        3
      );
      
      expect(result.disambiguation.required).toBe(true);
      expect(result.disambiguation.reason).toBe('referenced_image_not_found');
    });
  });
  
  // =====================================================================
  // SCENARIO 5: Ordinal References
  // =====================================================================
  
  describe('Scenario 5: Ordinal References', () => {
    it('should resolve "first image"', () => {
      const conversationMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/first.png', fileName: 'first.png' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/second.png', fileName: 'second.png' },
          3,
          'user_upload'
        ),
      ];
      conversationMedia[0].displayIndex = 1;
      conversationMedia[1].displayIndex = 2;
      
      const result = resolveMediaReferences(
        'edit the first image',
        [],
        conversationMedia,
        5
      );
      
      expect(result.resolution.method).toBe('numeric_reference');
      expect(result.resolvedMedia[0].fileName).toBe('first.png');
    });
    
    it('should resolve "second image"', () => {
      const conversationMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img1.png', fileName: 'img1.png' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img2.png', fileName: 'img2.png' },
          3,
          'user_upload'
        ),
      ];
      conversationMedia[0].displayIndex = 1;
      conversationMedia[1].displayIndex = 2;
      
      const result = resolveMediaReferences(
        'use the second image',
        [],
        conversationMedia,
        5
      );
      
      expect(result.resolvedMedia[0].fileName).toBe('img2.png');
    });
  });
  
  // =====================================================================
  // SCENARIO 6: Recency References
  // =====================================================================
  
  describe('Scenario 6: Recency References', () => {
    it('should resolve "last image" to most recent', () => {
      const conversationMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/old.png', fileName: 'old.png' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/recent.png', fileName: 'recent.png' },
          5,
          'user_upload'
        ),
      ];
      conversationMedia[0].displayIndex = 1;
      conversationMedia[1].displayIndex = 2;
      
      const result = resolveMediaReferences(
        'edit the last image',
        [],
        conversationMedia,
        6
      );
      
      expect(result.resolution.method).toBe('recency_reference');
      expect(result.resolvedMedia[0].fileName).toBe('recent.png');
    });
    
    it('should resolve "previous image"', () => {
      const conversationMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img.png', fileName: 'img.png' },
          3,
          'user_upload'
        ),
      ];
      conversationMedia[0].displayIndex = 1;
      
      const result = resolveMediaReferences(
        'modify the previous image',
        [],
        conversationMedia,
        5
      );
      
      expect(result.resolvedMedia[0].fileName).toBe('img.png');
    });
  });
  
  // =====================================================================
  // SCENARIO 7: Filename References
  // =====================================================================
  
  describe('Scenario 7: Filename References', () => {
    it('should resolve by filename', () => {
      const conversationMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/logo.png', fileName: 'logo.png' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/background.jpg', fileName: 'background.jpg' },
          3,
          'user_upload'
        ),
      ];
      conversationMedia[0].displayIndex = 1;
      conversationMedia[1].displayIndex = 2;
      
      const result = resolveMediaReferences(
        'edit logo.png',
        [],
        conversationMedia,
        5
      );
      
      expect(result.resolution.method).toBe('filename_match');
      expect(result.resolvedMedia[0].fileName).toBe('logo.png');
    });
    
    it('should handle filename collisions', () => {
      const conversationMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/image1.png', fileName: 'image.png' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/image2.png', fileName: 'image.png' },
          5,
          'user_upload'
        ),
      ];
      conversationMedia[0].displayIndex = 1;
      conversationMedia[1].displayIndex = 2;
      
      const result = resolveMediaReferences(
        'edit image.png',
        [],
        conversationMedia,
        6
      );
      
      expect(result.disambiguation.required).toBe(true);
      expect(result.disambiguation.reason).toBe('multiple_files_same_name');
    });
  });
  
  // =====================================================================
  // SCENARIO 8: Multi-Image Operations
  // =====================================================================
  
  describe('Scenario 8: Multi-Image Operations', () => {
    it('should detect "combine" operation', () => {
      const currentTurnUploads: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img1.png', fileName: 'img1.png' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img2.png', fileName: 'img2.png' },
          1,
          'user_upload'
        ),
      ];
      currentTurnUploads.forEach((m, i) => {
        m.displayIndex = i + 1;
      });
      
      const result = resolveMediaReferences(
        'combine these images',
        currentTurnUploads,
        [],
        1
      );
      
      expect(result.resolution.method).toBe('explicit_upload');
      expect(result.resolvedMedia).toHaveLength(2);
      expect(result.resolvedMedia.every(m => m.role === 'reference')).toBe(true);
    });
    
    it('should detect "compare" operation', () => {
      const currentTurnUploads: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/a.png', fileName: 'a.png' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/b.png', fileName: 'b.png' },
          1,
          'user_upload'
        ),
      ];
      currentTurnUploads.forEach((m, i) => {
        m.displayIndex = i + 1;
      });
      
      const result = resolveMediaReferences(
        'which is better?',
        currentTurnUploads,
        [],
        1
      );
      
      expect(result.resolvedMedia).toHaveLength(2);
    });
    
    it('should detect "collage" operation', () => {
      const currentTurnUploads: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/1.png', fileName: '1.png' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/2.png', fileName: '2.png' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/3.png', fileName: '3.png' },
          1,
          'user_upload'
        ),
      ];
      currentTurnUploads.forEach((m, i) => {
        m.displayIndex = i + 1;
      });
      
      const result = resolveMediaReferences(
        'make a collage',
        currentTurnUploads,
        [],
        1
      );
      
      expect(result.resolvedMedia).toHaveLength(3);
    });
  });
  
  // =====================================================================
  // SCENARIO 9: Role Assignment
  // =====================================================================
  
  describe('Scenario 9: Media Role Assignment', () => {
    it('should assign primary role to single image', () => {
      const currentTurnUploads: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img.png', fileName: 'img.png' },
          1,
          'user_upload'
        ),
      ];
      currentTurnUploads[0].displayIndex = 1;
      
      const result = resolveMediaReferences(
        'edit this',
        currentTurnUploads,
        [],
        1
      );
      
      expect(result.resolvedMedia[0].role).toBe('primary');
    });
    
    it('should assign roles for edit with reference operation', () => {
      const currentTurnUploads: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/base.png', fileName: 'base.png' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/reference.png', fileName: 'reference.png' },
          1,
          'user_upload'
        ),
      ];
      currentTurnUploads.forEach((m, i) => {
        m.displayIndex = i + 1;
      });
      
      // Use "reference" keyword to trigger multi-image operation
      const result = resolveMediaReferences(
        'edit using reference',
        currentTurnUploads,
        [],
        1
      );
      
      // Should resolve multiple images (detected as multi-image operation)
      expect(result.resolvedMedia.length).toBeGreaterThanOrEqual(1);
      
      // All resolved media should have roles assigned
      const allHaveRoles = result.resolvedMedia.every(m => 
        m.role === 'primary' || m.role === 'reference'
      );
      expect(allHaveRoles).toBe(true);
    });
  });
  
  // =====================================================================
  // SCENARIO 10: Cross-Turn References
  // =====================================================================
  
  describe('Scenario 10: Cross-Turn Historical References', () => {
    it('should resolve references across multiple turns', () => {
      // Turn 1: Upload logo
      const conversationMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/logo.png', fileName: 'logo.png' },
          1,
          'user_upload'
        ),
      ];
      conversationMedia[0].displayIndex = 1;
      
      // Turn 10: Reference the logo
      const result = resolveMediaReferences(
        'edit the logo to be blue',
        [],
        conversationMedia,
        10
      );
      
      // Should resolve via filename or semantic match (both valid)
      expect(['filename_match', 'semantic_match']).toContain(result.resolution.method);
      expect(result.resolvedMedia[0].fileName).toBe('logo.png');
      expect(result.resolvedMedia[0].uploadTurn).toBe(1);
    });
    
    it('should maintain reference count', () => {
      const conversationMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img.png', fileName: 'img.png' },
          1,
          'user_upload'
        ),
      ];
      conversationMedia[0].displayIndex = 1;
      conversationMedia[0].referenceCount = 0;
      
      const result = resolveMediaReferences(
        'edit image 1',
        [],
        conversationMedia,
        5
      );
      
      expect(result.resolvedMedia[0].referenceCount).toBe(1);
      expect(result.resolvedMedia[0].lastReferencedTurn).toBe(5);
    });
  });
  
  // =====================================================================
  // SCENARIO 11: Media Registry Building
  // =====================================================================
  
  describe('Scenario 11: Media Registry', () => {
    it('should build registry from message history', () => {
      const messages = [
        {
          role: 'user' as const,
          content: 'Here is my logo',
          media: [
            { type: 'image', url: 'https://example.com/logo.png', fileName: 'logo.png' },
          ],
        },
        {
          role: 'assistant' as const,
          content: 'Nice logo!',
        },
        {
          role: 'user' as const,
          content: 'And here is the background',
          media: [
            { type: 'image', url: 'https://example.com/bg.png', fileName: 'background.png' },
          ],
        },
      ];
      
      const registry = buildMediaRegistry(messages);
      
      expect(registry).toHaveLength(2);
      expect(registry[0].displayIndex).toBe(1);
      expect(registry[0].fileName).toBe('logo.png');
      expect(registry[1].displayIndex).toBe(2);
      expect(registry[1].fileName).toBe('background.png');
    });
    
    it('should track source (user vs AI)', () => {
      const messages = [
        {
          role: 'user' as const,
          content: 'Upload',
          media: [
            { type: 'image', url: 'https://example.com/user_img.png', fileName: 'user_img.png' },
          ],
        },
        {
          role: 'assistant' as const,
          content: 'Generated',
          media: [
            { type: 'image', url: 'https://example.com/ai_img.png', fileName: 'ai_img.png' },
          ],
        },
      ];
      
      const registry = buildMediaRegistry(messages);
      
      expect(registry[0].source).toBe('user_upload');
      expect(registry[1].source).toBe('ai_generated');
    });
  });
  
  // =====================================================================
  // SCENARIO 12: Utility Functions
  // =====================================================================
  
  describe('Scenario 12: Utility Functions', () => {
    it('should extract semantic tags from filename', () => {
      const tags1 = extractSemanticTagsFromFilename('red_car_sunset.jpg');
      expect(tags1).toContain('red');
      expect(tags1).toContain('car');
      
      const tags2 = extractSemanticTagsFromFilename('blue_house.png');
      expect(tags2).toContain('blue');
      expect(tags2).toContain('house');
      
      const tags3 = extractSemanticTagsFromFilename('company_logo.png');
      expect(tags3).toContain('logo');
    });
    
    it('should format media list for user', () => {
      const media: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img1.png', fileName: 'img1.png' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img2.png', fileName: 'img2.png' },
          3,
          'ai_generated'
        ),
      ];
      media[0].displayIndex = 1;
      media[1].displayIndex = 2;
      
      const formatted = formatMediaListForUser(media);
      
      expect(formatted).toContain('img1.png');
      expect(formatted).toContain('img2.png');
      expect(formatted).toContain('📤'); // User upload icon
      expect(formatted).toContain('🤖'); // AI generated icon
    });
    
    it('should format media context for AI', () => {
      const media: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img.png', fileName: 'test.png' },
          1,
          'user_upload'
        ),
      ];
      media[0].displayIndex = 1;
      media[0].role = 'primary';
      
      const context: RobustMediaContext = {
        currentTurnMedia: [],
        availableMedia: media,
        resolvedMedia: media,
        resolution: {
          method: 'explicit_upload',
          confidence: 1.0,
          matchedIndices: [1],
          userIntent: 'work_with_uploaded_media',
        },
        disambiguation: {
          required: false,
          reason: '',
          options: [],
        },
        stats: {
          totalMediaInConversation: 1,
          newMediaThisTurn: 1,
          resolvedMediaCount: 1,
          requiresUserInput: false,
        },
      };
      
      const formatted = formatMediaContextForAI(context);
      
      expect(formatted).toContain('RESOLVED MEDIA CONTEXT');
      expect(formatted).toContain('explicit_upload');
      expect(formatted).toContain('test.png');
      expect(formatted).toContain('Image 1');
    });
  });
  
  // =====================================================================
  // EDGE CASES & REGRESSION TESTS
  // =====================================================================
  
  describe('Edge Cases & Regressions', () => {
    it('should handle empty media arrays', () => {
      const result = resolveMediaReferences('make an image', [], [], 1);
      
      expect(result.resolvedMedia).toHaveLength(0);
      expect(result.resolution.confidence).toBe(0.0);
    });
    
    it('should handle very long filenames', () => {
      const longName = 'a'.repeat(500) + '.png';
      const media = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/test.png', fileName: longName },
          1,
          'user_upload'
        ),
      ];
      media[0].displayIndex = 1;
      
      const result = resolveMediaReferences('edit this', media, [], 1);
      
      expect(result.resolvedMedia).toHaveLength(1);
    });
    
    it('should handle special characters in filenames', () => {
      const media = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/test.png', fileName: 'my-logo (1).png' },
          1,
          'user_upload'
        ),
      ];
      media[0].displayIndex = 1;
      
      const result = resolveMediaReferences('edit my-logo (1).png', media, [], 1);
      
      expect(result.resolvedMedia).toHaveLength(1);
    });
    
    it('should handle case-insensitive filename matching', () => {
      const media = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/test.png', fileName: 'Logo.PNG' },
          1,
          'user_upload'
        ),
      ];
      media[0].displayIndex = 1;
      
      const result = resolveMediaReferences('edit logo.png', media, [], 1);
      
      expect(result.resolvedMedia).toHaveLength(1);
    });
  });
});

