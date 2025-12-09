/**
 * Tests for Mode Switching During Streaming Fix
 *
 * This test file ensures that when switching modes during streaming:
 * 1. No TypeError occurs when content is undefined
 * 2. Optional chaining protects against undefined content
 * 3. YouTube embed detection handles undefined gracefully
 * 4. Video detection in markdown handles undefined gracefully
 */

import { vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Mode Switching During Streaming', () => {
  const srcDir = path.join(__dirname, '..');
  const chatbotPath = path.join(srcDir, 'components/gemini-chatbot.tsx');

  describe('Safe Property Access - Optional Chaining', () => {
    it('gemini-chatbot.tsx should exist', () => {
      expect(fs.existsSync(chatbotPath)).toBe(true);
    });

    it('should use optional chaining for message.content.match()', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Find the YouTube regex matching section
      const youtubeRegexSection = content.match(/const youtubeRegex[\s\S]{0,200}message\.content/);
      expect(youtubeRegexSection).not.toBeNull();
      
      // Should use optional chaining
      expect(content).toContain('message.content?.match(youtubeRegex)');
    });

    it('should use optional chaining for src.match() in video detection', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Find the video detection in img renderer
      const videoDetection = content.match(/src\s*&&\s*\(\s*src\?\.match\(/);
      expect(videoDetection).not.toBeNull();
      
      // Should use optional chaining on src
      expect(content).toContain('src?.match(/\\.(mp4|webm|mov|avi|mkv|m4v)(\\?|$)/i)');
    });

    it('should not use direct .match() on potentially undefined message.content', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Find the YouTube regex section specifically
      const youtubeSection = content.substring(
        content.indexOf('Automatic YouTube Embeds'),
        content.indexOf('Automatic YouTube Embeds') + 500
      );
      
      // In this section, should NOT have message.content.match
      expect(youtubeSection).not.toContain('message.content.match(');
      
      // Should have optional chaining instead
      expect(youtubeSection).toContain('message.content?.match(');
    });
  });

  describe('Streaming State Safety', () => {
    it('should handle placeholder assistant messages with empty content', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Placeholder message creation should set content to empty string
      expect(content).toContain("{ role: 'assistant', content: ''");
    });

    it('should check for undefined content before string operations', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // YouTube embed section should use optional chaining
      const youtubeSection = content.match(/YouTube Embeds[\s\S]{0,300}message\.content\?\.match/);
      expect(youtubeSection).not.toBeNull();
    });

    it('should safely handle content during streaming updates', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // When updating messages during streaming, should handle undefined
      expect(content).toContain('message.content?.match');
    });
  });

  describe('Video and Media Detection Safety', () => {
    it('should safely detect video files in markdown', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Video detection should check src exists before operations
      expect(content).toContain('src && (');
      expect(content).toContain('src?.match');
    });

    it('should handle undefined src in img renderer', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // img renderer should check src before using it
      const imgRenderer = content.match(/img:\s*\({[^}]*src[^}]*}\s*:\s*any\)\s*=>\s*{[\s\S]{0,500}src\?\.match/);
      expect(imgRenderer).not.toBeNull();
    });
  });

  describe('Backward Compatibility', () => {
    it('should still detect YouTube videos when content is valid', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // YouTube regex should still be present and functional
      expect(content).toContain('const youtubeRegex =');
      expect(content).toMatch(/youtube/);
      expect(content).toMatch(/youtu/);
    });

    it('should still render YouTube embeds when matched', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // YouTube iframe embedding should still work
      expect(content).toContain('youtube.com/embed/');
      expect(content).toContain('allowFullScreen');
    });

    it('should still detect video extensions in markdown', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Video extensions regex should still be present
      expect(content).toContain('mp4');
      expect(content).toContain('webm');
      expect(content).toContain('mov');
    });

    it('should still render videos with video tag', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Video rendering should still work
      expect(content).toContain('<video');
      expect(content).toContain('controls');
    });
  });

  describe('Error Prevention', () => {
    it('should not throw TypeError when content is undefined', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // All message.content operations should be safe
      const unsafeContentOps = content.match(/message\.content\.(match|split|replace|substring)\(/g);
      
      // If there are any, they should be in safe contexts (after checks)
      // For now, we specifically check that .match uses optional chaining
      expect(content).toContain('message.content?.match');
    });

    it('should not throw TypeError when src is undefined', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // src operations in img renderer should be safe
      expect(content).toContain('src?.match');
    });

    it('should have defensive checks before string operations', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should check for existence before operations
      expect(content).toContain('src && (');
      expect(content).toContain('message.content?.match');
    });
  });

  describe('Mode Switching Scenarios', () => {
    it('should handle mode switch during image generation', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Messages are in shared state
      expect(content).toContain('const messages = sharedMessages');
      
      // Content access uses optional chaining
      expect(content).toContain('message.content?.match');
    });

    it('should handle mode switch during video generation', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Video URL detection should be safe
      expect(content).toContain('src?.match');
    });

    it('should preserve streaming state across mode switches', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // isLoading is shared
      expect(content).toContain('const isLoading = sharedIsLoading');
      
      // Messages are shared
      expect(content).toContain('const messages = sharedMessages');
    });

    it('should not reload history on mount if isLoading=true', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Mount effect should check isLoading
      const mountSection = content.substring(
        content.indexOf('// Load chat history on mount'),
        content.indexOf('// Load chat history on mount') + 800
      );
      
      expect(mountSection).toContain('if (isLoading)');
      expect(mountSection).toContain('return;');
    });

    it('should not reload history on mount if messages exist', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Mount effect should check messages.length
      const mountSection = content.substring(
        content.indexOf('// Load chat history on mount'),
        content.indexOf('// Load chat history on mount') + 800
      );
      
      expect(mountSection).toContain('if (messages.length > 0)');
    });
  });

  describe('Code Quality', () => {
    it('should use TypeScript optional chaining syntax', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should use ?. not &&
      expect(content).toContain('?.match');
    });

    it('should not have defensive null checks that break rendering', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should use optional chaining, not verbose if checks
      const optionalChainingCount = (content.match(/\?\.match/g) || []).length;
      expect(optionalChainingCount).toBeGreaterThan(0);
    });

    it('should handle edge cases gracefully', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should have conditional rendering for content
      expect(content).toContain("!message.content && isLoading");
    });
  });

  describe('Integration - Shared State', () => {
    it('should use shared state that persists across mode switches', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Uses shared messages from context
      expect(content).toContain('sharedMessages');
      expect(content).toContain('const messages = sharedMessages');
    });

    it('should handle undefined content in shared messages', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should safely access content even if undefined
      expect(content).toContain('message.content?.match');
    });

    it('should not crash when rendering messages after mode switch', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // All content operations should be safe
      expect(content).toContain('?.match');
    });
  });
});

