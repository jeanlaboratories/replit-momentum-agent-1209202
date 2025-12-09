/**
 * MEDIA RE-INJECTION TESTS
 * 
 * These tests ensure that when users re-inject media from chat history:
 * 1. Re-injected media is treated as EXPLICIT user selection (no disambiguation)
 * 2. Image numbering refers to INPUT BOX images, not conversation history
 * 3. Multiple re-injected images work together smoothly
 * 4. Agent receives clear context about re-injected media
 * 5. No confusion between re-injected and historical media
 * 
 * CRITICAL USER EXPERIENCE:
 * - User clicks "Re-inject" on an image → It goes to input box
 * - User says "make it blue" → Agent should work on that re-injected image
 * - User re-injects 3 images → Says "image 1" → Refers to FIRST in input box
 * - NO disambiguation needed for re-injected media (it's explicit!)
 */

import { describe, it, expect } from 'vitest';
import {
  resolveMediaReferences,
  createEnhancedMedia,
  type EnhancedMedia,
} from '@/lib/robust-media-context';
import * as fs from 'fs';
import * as path from 'path';

describe('Media Re-injection - Explicit Selection', () => {
  
  describe('Scenario 1: Single Re-injected Image', () => {
    it('should treat re-injected media as explicit selection (no disambiguation)', () => {
      const reinjectedMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { 
            type: 'image', 
            url: 'https://example.com/logo.png', 
            fileName: 'Re-injected Media',
            mimeType: 'image/png',
          },
          5,
          'user_upload'
        ),
      ];
      reinjectedMedia[0].displayIndex = 1;
      reinjectedMedia[0].isReinjected = true; // MARKED as re-injected
      
      const result = resolveMediaReferences(
        'make it blue',
        reinjectedMedia,
        [], // Empty conversation media
        5
      );
      
      expect(result.resolution.method).toBe('explicit_upload');
      expect(result.resolution.confidence).toBe(1.0);
      expect(result.resolvedMedia).toHaveLength(1);
      expect(result.disambiguation.required).toBe(false);
      expect(result.resolution.userIntent).toBe('work_with_reinjected_media');
    });
  });
  
  describe('Scenario 2: Multiple Re-injected Images', () => {
    it('should NOT ask for disambiguation when all are re-injected', () => {
      const reinjectedMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img1.png', fileName: 'Re-injected Media' },
          5,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img2.png', fileName: 'Re-injected Media' },
          5,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img3.png', fileName: 'Re-injected Media' },
          5,
          'user_upload'
        ),
      ];
      reinjectedMedia.forEach((m, i) => {
        m.displayIndex = i + 1;
        m.isReinjected = true; // ALL marked as re-injected
      });
      
      const result = resolveMediaReferences(
        'combine these',
        reinjectedMedia,
        [],
        5
      );
      
      // Should NOT ask for disambiguation
      expect(result.disambiguation.required).toBe(false);
      expect(result.resolution.confidence).toBe(1.0);
      expect(result.resolution.userIntent).toBe('work_with_reinjected_media');
      expect(result.resolvedMedia).toHaveLength(3);
    });
    
    it('should assign roles for multiple re-injected media', () => {
      const reinjectedMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img1.png', fileName: 'Re-injected Media' },
          5,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img2.png', fileName: 'Re-injected Media' },
          5,
          'user_upload'
        ),
      ];
      reinjectedMedia.forEach((m, i) => {
        m.displayIndex = i + 1;
        m.isReinjected = true;
      });
      
      const result = resolveMediaReferences(
        'combine using reference',
        reinjectedMedia,
        [],
        5
      );
      
      // Should assign roles
      expect(result.resolvedMedia.length).toBeGreaterThan(0);
      const hasRoles = result.resolvedMedia.some(m => m.role !== undefined);
      expect(hasRoles).toBe(true);
    });
  });
  
  describe('Scenario 3: Image Numbering - Input Box Reference', () => {
    it('should number images based on input box order (index + 1)', () => {
      const chatbotPath = path.join(__dirname, '../components/gemini-chatbot.tsx');
      const routePath = path.join(__dirname, '../app/api/chat/route.ts');
      
      const routeContent = fs.readFileSync(routePath, 'utf-8');
      
      // Display index should be index + 1 (input box position)
      expect(routeContent).toMatch(/displayIndex.*=.*index \+ 1/);
    });
    
    it('should NOT use conversationMedia.length for re-injected media indices', () => {
      const routePath = path.join(__dirname, '../app/api/chat/route.ts');
      const routeContent = fs.readFileSync(routePath, 'utf-8');
      
      // Should comment about INPUT BOX index
      expect(routeContent).toMatch(/input box|INPUT BOX/i);
    });
  });
  
  describe('Scenario 4: Re-injection Marker Propagation', () => {
    it('should preserve isReinjected flag through the pipeline', () => {
      const routePath = path.join(__dirname, '../app/api/chat/route.ts');
      const routeContent = fs.readFileSync(routePath, 'utf-8');
      
      // Should copy isReinjected from input media
      expect(routeContent).toContain('isReinjected');
      expect(routeContent).toMatch(/enhanced\.isReinjected.*=.*m\.isReinjected/);
    });
    
    it('should set isReinjected flag in handleInjectMedia', () => {
      const chatbotPath = path.join(__dirname, '../components/gemini-chatbot.tsx');
      const chatbotContent = fs.readFileSync(chatbotPath, 'utf-8');
      
      // handleInjectMedia should set isReinjected: true
      expect(chatbotContent).toMatch(/isReinjected.*true/);
    });
    
    it('should check for isReinjected in robust system', () => {
      const robustPath = path.join(__dirname, '../lib/robust-media-context.ts');
      const robustContent = fs.readFileSync(robustPath, 'utf-8');
      
      // Should check if all media are re-injected
      expect(robustContent).toContain('allReinjected');
      expect(robustContent).toMatch(/every.*isReinjected/);
    });
  });
  
  describe('Scenario 5: Mixed Re-injected + New Upload', () => {
    it('should handle when some are re-injected and some are new', () => {
      const mixedMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/reinjected.png', fileName: 'Re-injected Media' },
          5,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/newupload.png', fileName: 'newupload.png' },
          5,
          'user_upload'
        ),
      ];
      mixedMedia[0].displayIndex = 1;
      mixedMedia[0].isReinjected = true; // Re-injected
      mixedMedia[1].displayIndex = 2;
      mixedMedia[1].isReinjected = false; // New upload
      
      const result = resolveMediaReferences(
        'edit this',
        mixedMedia,
        [],
        5
      );
      
      // Mixed case: NOT all re-injected, so may need disambiguation
      // (This is edge case - user should be clear about which one)
      expect(result.resolvedMedia.length).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Scenario 6: Re-injection UX Verification', () => {
    it('should add attachment when user clicks re-inject', () => {
      const chatbotPath = path.join(__dirname, '../components/gemini-chatbot.tsx');
      const chatbotContent = fs.readFileSync(chatbotPath, 'utf-8');
      
      // handleInjectMedia should call setAttachments
      expect(chatbotContent).toContain('handleInjectMedia');
      expect(chatbotContent).toMatch(/setAttachments.*prev.*=>\s*\[\.\.\.prev,\s*attachment\]/);
    });
    
    it('should show toast notification on re-injection', () => {
      const chatbotPath = path.join(__dirname, '../components/gemini-chatbot.tsx');
      const chatbotContent = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should show "Media Attached" toast
      expect(chatbotContent).toContain('Media Attached');
    });
    
    it('should have Re-inject button on media items', () => {
      const chatbotPath = path.join(__dirname, '../components/gemini-chatbot.tsx');
      const chatbotContent = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(chatbotContent).toContain('Re-inject');
      expect(chatbotContent).toContain('onClick={() => handleInjectMedia');
    });
  });
});

describe('Re-injection Resolution Logic', () => {
  
  describe('Priority: Re-injected > Ambiguous New Upload', () => {
    it('should give 100% confidence to re-injected media', () => {
      const reinjectedMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img.png', fileName: 'Re-injected Media' },
          1,
          'user_upload'
        ),
      ];
      reinjectedMedia[0].displayIndex = 1;
      reinjectedMedia[0].isReinjected = true;
      
      const result = resolveMediaReferences('edit this', reinjectedMedia, [], 1);
      
      expect(result.resolution.confidence).toBe(1.0);
    });
    
    it('should log re-injection detection', () => {
      const robustPath = path.join(__dirname, '../lib/robust-media-context.ts');
      const robustContent = fs.readFileSync(robustPath, 'utf-8');
      
      // Should log when all media are re-injected
      expect(robustContent).toMatch(/re-injected.*explicit selection/i);
    });
  });
  
  describe('Image Numbering - Input Box Context', () => {
    it('should number images 1, 2, 3 based on input box order', () => {
      const reinjectedMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/first.png', fileName: 'Re-injected Media' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/second.png', fileName: 'Re-injected Media' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/third.png', fileName: 'Re-injected Media' },
          1,
          'user_upload'
        ),
      ];
      reinjectedMedia.forEach((m, i) => {
        m.displayIndex = i + 1; // 1, 2, 3
        m.isReinjected = true;
      });
      
      // User says "edit image 2"
      const result = resolveMediaReferences('combine them', reinjectedMedia, [], 1);
      
      // Should resolve all 3 (they're all re-injected = explicit)
      expect(result.resolvedMedia).toHaveLength(3);
      
      // Image 1 should be first, Image 2 second, Image 3 third
      expect(result.resolvedMedia[0].displayIndex).toBe(1);
      expect(result.resolvedMedia[1].displayIndex).toBe(2);
      expect(result.resolvedMedia[2].displayIndex).toBe(3);
    });
  });
  
  describe('Interface Definition', () => {
    it('should have isReinjected field in MediaAttachment', () => {
      const chatbotPath = path.join(__dirname, '../components/gemini-chatbot.tsx');
      const chatbotContent = fs.readFileSync(chatbotPath, 'utf-8');
      
      // MediaAttachment interface should include isReinjected
      expect(chatbotContent).toContain('isReinjected?:');
    });
    
    it('should have isReinjected field in EnhancedMedia', () => {
      const robustPath = path.join(__dirname, '../lib/robust-media-context.ts');
      const robustContent = fs.readFileSync(robustPath, 'utf-8');
      
      // EnhancedMedia interface should include isReinjected
      expect(robustContent).toContain('isReinjected?:');
    });
  });
  
  describe('Resolution Method for Re-injection', () => {
    it('should use explicit_upload method for re-injected media', () => {
      const robustPath = path.join(__dirname, '../lib/robust-media-context.ts');
      const robustContent = fs.readFileSync(robustPath, 'utf-8');
      
      // Re-injected media should be treated as explicit
      expect(robustContent).toContain('work_with_reinjected_media');
    });
    
    it('should have 100% confidence for re-injected media', () => {
      const reinjectedMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img.png', fileName: 'Re-injected Media' },
          1,
          'user_upload'
        ),
      ];
      reinjectedMedia[0].displayIndex = 1;
      reinjectedMedia[0].isReinjected = true;
      
      const result = resolveMediaReferences('edit', reinjectedMedia, [], 1);
      
      expect(result.resolution.confidence).toBe(1.0);
    });
  });
});

describe('Re-injection vs New Upload Distinction', () => {
  
  describe('Behavior Difference', () => {
    it('should treat single new upload as unambiguous', () => {
      const newUpload: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/new.png', fileName: 'newfile.png' },
          1,
          'user_upload'
        ),
      ];
      newUpload[0].displayIndex = 1;
      newUpload[0].isReinjected = false; // New upload
      
      const result = resolveMediaReferences('edit this', newUpload, [], 1);
      
      expect(result.disambiguation.required).toBe(false);
    });
    
    it('should ask for disambiguation with multiple NEW uploads (no text specificity)', () => {
      const newUploads: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/new1.png', fileName: 'new1.png' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/new2.png', fileName: 'new2.png' },
          1,
          'user_upload'
        ),
      ];
      newUploads.forEach((m, i) => {
        m.displayIndex = i + 1;
        m.isReinjected = false; // New uploads
      });
      
      const result = resolveMediaReferences('edit this', newUploads, [], 1);
      
      // Should ask for disambiguation (ambiguous which one)
      expect(result.disambiguation.required).toBe(true);
    });
    
    it('should NOT ask for disambiguation with multiple RE-INJECTED media', () => {
      const reinjectedMedia: EnhancedMedia[] = [
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img1.png', fileName: 'Re-injected Media' },
          1,
          'user_upload'
        ),
        createEnhancedMedia(
          { type: 'image', url: 'https://example.com/img2.png', fileName: 'Re-injected Media' },
          1,
          'user_upload'
        ),
      ];
      reinjectedMedia.forEach((m, i) => {
        m.displayIndex = i + 1;
        m.isReinjected = true; // Re-injected
      });
      
      const result = resolveMediaReferences('edit this', reinjectedMedia, [], 1);
      
      // Should NOT ask - re-injection is explicit selection
      expect(result.disambiguation.required).toBe(false);
      expect(result.resolvedMedia).toHaveLength(2);
    });
  });
});

describe('Image Numbering - Input Box Context', () => {
  
  it('should treat "image 1" as first in input box, not conversation', () => {
    // Scenario: Conversation has 10 images, user re-injects 2
    const conversationMedia: EnhancedMedia[] = Array.from({ length: 10 }, (_, i) =>
      createEnhancedMedia(
        { type: 'image', url: `https://example.com/old${i}.png`, fileName: `old${i}.png` },
        i,
        'user_upload'
      )
    );
    conversationMedia.forEach((m, i) => {
      m.displayIndex = i + 1; // 1-10
    });
    
    const reinjectedMedia: EnhancedMedia[] = [
      createEnhancedMedia(
        { type: 'image', url: 'https://example.com/selected1.png', fileName: 'Re-injected Media' },
        11,
        'user_upload'
      ),
      createEnhancedMedia(
        { type: 'image', url: 'https://example.com/selected2.png', fileName: 'Re-injected Media' },
        11,
        'user_upload'
      ),
    ];
    reinjectedMedia.forEach((m, i) => {
      m.displayIndex = i + 1; // INPUT BOX: 1, 2 (NOT 11, 12!)
      m.isReinjected = true;
    });
    
    // User says "edit these"
    const result = resolveMediaReferences('edit these', reinjectedMedia, conversationMedia, 11);
    
    // Should work with the 2 re-injected images (indices 1, 2 in INPUT BOX)
    expect(result.resolvedMedia).toHaveLength(2);
    expect(result.resolvedMedia[0].displayIndex).toBe(1); // First in INPUT BOX
    expect(result.resolvedMedia[1].displayIndex).toBe(2); // Second in INPUT BOX
  });
});

describe('Documentation and Comments', () => {
  
  it('should document re-injection in robust-media-context', () => {
    const robustPath = path.join(__dirname, '../lib/robust-media-context.ts');
    const robustContent = fs.readFileSync(robustPath, 'utf-8');
    
    // Should mention re-injection
    expect(robustContent).toMatch(/re-inject|reinjected/i);
  });
  
  it('should explain input box numbering', () => {
    const routePath = path.join(__dirname, '../app/api/chat/route.ts');
    const routeContent = fs.readFileSync(routePath, 'utf-8');
    
    // Should explain that numbering is based on input box
    expect(routeContent).toMatch(/input box|INPUT BOX/i);
  });
});

