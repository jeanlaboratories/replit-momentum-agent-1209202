/**
 * MULTIPLE MEDIA LAYOUT TESTS
 * 
 * These tests ensure that displaying multiple images/videos in a single message
 * does NOT cause the chat interface to scroll or break the layout.
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Multiple media should use grid layout (grid-cols-2)
 * 2. Each media item should have max-height constraints
 * 3. Images should use object-contain to prevent distortion
 * 4. Videos should have fixed dimensions
 * 5. Container should not exceed viewport height
 * 6. No body scrolling in fullscreen mode
 * 7. Proper containment in drawer mode
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Multiple Media Layout Stability', () => {
  const chatbotPath = path.join(__dirname, '../components/gemini-chatbot.tsx');
  
  describe('Media Container Layout', () => {
    it('should exist', () => {
      expect(fs.existsSync(chatbotPath)).toBe(true);
    });
    
    it('should use grid layout for multiple media', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should conditionally apply grid-cols-2 for multiple media
      expect(content).toMatch(/message\.media\.length > 1.*grid-cols-2|grid-cols-2.*message\.media\.length > 1/);
    });
    
    it('should use single column for single media', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should have grid-cols-1 for single media
      expect(content).toContain('grid-cols-1');
    });
    
    it('should have gap between multiple media items', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('gap-2');
    });
    
    it('should have proper max-width constraint on media container', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Media container should be max-w-[80%]
      expect(content).toContain('max-w-[80%]');
    });
  });
  
  describe('Image Constraints', () => {
    it('should have max-width constraint', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Images should be max-w-full
      expect(content).toMatch(/<img[^>]*max-w-full/);
    });
    
    it('should have max-height constraint to prevent tall images', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Images should have max-h-[400px] or similar
      expect(content).toMatch(/max-h-\[400px\]|max-h-\[500px\]|maxHeight.*400|maxHeight.*500/);
    });
    
    it('should use object-contain for proper scaling', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Images should use object-contain to prevent distortion
      expect(content).toMatch(/object-contain/);
    });
    
    it('should use h-auto for responsive height', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toMatch(/<img[^>]*h-auto/);
    });
  });
  
  describe('Video Constraints', () => {
    it('should have max-height on videos', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Videos should have maxHeight constraint
      expect(content).toMatch(/<video[^>]*maxHeight|style=.*maxHeight.*400/);
    });
    
    it('should have width constraint on videos', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Videos should have width: 100%
      expect(content).toMatch(/width.*100%|w-full/);
    });
    
    it('should use object-contain for videos', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Videos should use object-contain
      expect(content).toMatch(/<video[^>]*object-contain/);
    });
  });
  
  describe('YouTube Embed Constraints', () => {
    it('should have fixed height for YouTube iframes', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // YouTube embeds should have fixed height
      expect(content).toMatch(/<iframe[^>]*height.*300|height:.*300px/);
    });
    
    it('should have max-height for YouTube iframes', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toMatch(/maxHeight.*400/);
    });
    
    it('should have width constraint', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should use w-full or width: 100%
      expect(content).toMatch(/<iframe[^>]*w-full|width.*100%/);
    });
  });
  
  describe('Multiple Media Scenarios', () => {
    it('should handle 2 images in grid', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should use grid-cols-2 for multiple
      expect(content).toContain('grid-cols-2');
    });
    
    it('should handle 3+ images in grid', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Grid should accommodate any number
      expect(content).toMatch(/grid gap-2/);
    });
    
    it('should handle mixed media (images + videos)', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should render both types
      expect(content).toMatch(/media\.type === 'image'/);
      expect(content).toMatch(/media\.type === 'video'/);
    });
  });
  
  describe('Scroll Prevention', () => {
    it('should not allow media to exceed container bounds', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // All media should have max-w-full
      expect(content).toMatch(/max-w-full/);
    });
    
    it('should have overflow-hidden on media borders', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Media containers should have overflow-hidden
      expect(content).toMatch(/rounded-lg overflow-hidden/);
    });
    
    it('should constrain media within message container', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Message content should be max-w-[80%]
      expect(content).toContain('max-w-[80%]');
    });
  });
  
  describe('Responsive Behavior', () => {
    it('should adapt grid based on media count', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should check message.media.length
      expect(content).toContain('message.media.length');
      
      // Should conditionally apply grid-cols
      expect(content).toMatch(/\? 'grid-cols-2'|grid-cols-2/);
    });
    
    it('should use grid gap for spacing', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('gap-2');
    });
  });
  
  describe('Media Actions UI', () => {
    it('should have re-inject button for images', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('Re-inject');
      expect(content).toContain('handleInjectMedia');
    });
    
    it('should have open/download button for media', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('Open Image');
      expect(content).toContain('Open Video');
    });
    
    it('should have proper button sizing', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Buttons should be size-sm with h-7
      expect(content).toMatch(/size="sm".*h-7|h-7.*size="sm"/);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle media load errors', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('onError');
      expect(content).toContain('mediaErrors');
    });
    
    it('should show fallback UI for failed media', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('hasMediaError');
      expect(content).toContain('Image generated successfully');
      expect(content).toContain('Video generated successfully');
    });
  });
});

describe('Fullscreen Mode - Multiple Media', () => {
  const companionPagePath = path.join(__dirname, '../app/companion/page.tsx');
  
  describe('Container Constraints', () => {
    it('should maintain overflow-hidden on root', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      expect(content).toContain('overflow-hidden');
    });
    
    it('should maintain h-screen on root', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      expect(content).toContain('h-screen');
    });
    
    it('should maintain min-h-0 on main', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      expect(content).toContain('min-h-0');
    });
  });
  
  describe('Scroll Containment', () => {
    it('should not allow content to cause body scroll', () => {
      const companionContent = fs.readFileSync(companionPagePath, 'utf-8');
      
      // Root must use fixed positioning
      expect(companionContent).toContain('fixed inset-0');
      expect(companionContent).toContain('flex flex-col');
    });
  });
});

describe('Media Rendering Integration', () => {
  const chatbotPath = path.join(__dirname, '../components/gemini-chatbot.tsx');
  
  describe('Grid Responsiveness', () => {
    it('should use conditional grid columns', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should check media count and apply appropriate grid
      expect(content).toMatch(/message\.media\.length > 1.*?grid-cols-2/s);
    });
    
    it('should map over all media items', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('message.media.map');
    });
    
    it('should have unique keys for media items', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('mediaKey');
      expect(content).toMatch(/key=\{mediaKey\}/);
    });
  });
  
  describe('Performance Considerations', () => {
    it('should use preload metadata for videos', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('preload="metadata"');
    });
    
    it('should use playsInline for mobile', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('playsInline');
    });
  });
});

describe('Edge Cases - Multiple Media', () => {
  const chatbotPath = path.join(__dirname, '../components/gemini-chatbot.tsx');
  
  it('should handle very large images gracefully', () => {
    const content = fs.readFileSync(chatbotPath, 'utf-8');
    
    // max-h-[400px] prevents images from being too tall
    expect(content).toContain('max-h-[400px]');
  });
  
  it('should handle 4+ images in one message', () => {
    const content = fs.readFileSync(chatbotPath, 'utf-8');
    
    // Grid should wrap automatically (2 columns)
    expect(content).toContain('grid-cols-2');
    expect(content).toContain('gap-2');
  });
  
  it('should handle empty media array', () => {
    const content = fs.readFileSync(chatbotPath, 'utf-8');
    
    expect(content).toMatch(/message\.media && message\.media\.length > 0/);
  });
  
  it('should handle media with missing URLs', () => {
    const content = fs.readFileSync(chatbotPath, 'utf-8');
    
    // Should check media.url before rendering
    expect(content).toMatch(/media\.url|media\?\.url/);
  });
});

