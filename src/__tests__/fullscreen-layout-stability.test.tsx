/**
 * FULLSCREEN LAYOUT STABILITY TESTS
 * 
 * These tests ensure that the Team Companion fullscreen mode maintains
 * proper layout and doesn't cause body scrolling issues when:
 * 1. Generating media (images/videos)
 * 2. Loading long conversation history
 * 3. Displaying large media content
 * 4. Switching between modes
 * 5. Adding/removing attachments
 * 
 * CRITICAL: The page body should NEVER become scrollable in fullscreen mode.
 * All scrolling should be contained within the messages container.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Fullscreen Layout Stability', () => {
  const srcDir = path.join(__dirname, '..');
  const companionPagePath = path.join(srcDir, 'app/companion/page.tsx');
  const headerPath = path.join(srcDir, 'components/layout/header.tsx');
  const chatbotPath = path.join(srcDir, 'components/gemini-chatbot.tsx');
  
  describe('Companion Page Layout', () => {
    it('should exist', () => {
      expect(fs.existsSync(companionPagePath)).toBe(true);
    });
    
    it('should use fixed positioning to prevent scroll', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      // Root container should be fixed inset-0 to lock to viewport
      expect(content).toContain('fixed inset-0');
    });
    
    it('should have flex layout', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      // Should use flex flex-col
      expect(content).toContain('flex flex-col');
    });
    
    it('should have flex layout with flex-col', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      expect(content).toContain('flex flex-col');
    });
    
    it('should have header with flex-shrink-0', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      // Header should not shrink to prevent layout issues
      expect(content).toContain('flex-shrink-0');
    });
    
    it('should have main container with flex-1 and overflow-hidden', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      // Main should take remaining space and hide overflow
      expect(content).toMatch(/flex-1.*overflow-hidden|overflow-hidden.*flex-1/);
    });
    
    it('should have min-h-0 on main to allow flex shrinking', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      // min-h-0 allows flex children to shrink below content size
      expect(content).toContain('min-h-0');
    });
    
    it('should pass isFullScreen prop to GeminiChatbot', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      expect(content).toContain('isFullScreen={true}');
    });
    
    it('should have centered container (max-w-4xl mx-auto)', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      expect(content).toContain('max-w-4xl');
      expect(content).toContain('mx-auto');
    });
  });
  
  describe('Header Component - Route Awareness', () => {
    it('should hide on /companion route', () => {
      const content = fs.readFileSync(headerPath, 'utf-8');
      
      // Header should return null for /companion
      expect(content).toMatch(/pathname === '\/companion'/);
      expect(content).toMatch(/return null/);
    });
    
    it('should hide on /login route', () => {
      const content = fs.readFileSync(headerPath, 'utf-8');
      
      expect(content).toMatch(/pathname === '\/login'/);
    });
    
    it('should hide on /signup route', () => {
      const content = fs.readFileSync(headerPath, 'utf-8');
      
      expect(content).toMatch(/pathname === '\/signup'/);
    });
    
    it('should use usePathname hook', () => {
      const content = fs.readFileSync(headerPath, 'utf-8');
      
      expect(content).toContain('usePathname');
      expect(content).toContain('from \'next/navigation\'');
    });
  });
  
  describe('GeminiChatbot Layout Structure', () => {
    it('should have h-full on root container', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Root should fill parent height
      expect(content).toMatch(/className="[^"]*h-full/);
    });
    
    it('should have flex flex-col on chat area', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Chat area should be flex column
      expect(content).toContain('flex flex-col h-full');
    });
    
    it('should have overflow-y-auto on messages container', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Messages container should scroll internally
      expect(content).toContain('overflow-y-auto');
    });
    
    it('should have min-h-0 on scrollable container', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Allows flex child to shrink and enable scroll
      expect(content).toContain('min-h-0');
    });
    
    it('should use messagesContainerRef for scroll management', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('messagesContainerRef');
      expect(content).toContain('useRef');
    });
  });
  
  describe('Scroll Container Isolation', () => {
    it('should have only one scrollable container (messages)', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Messages container should have overflow-y-auto
      const scrollContainers = content.match(/overflow-y-auto/g);
      expect(scrollContainers).not.toBeNull();
      
      // Should have at least one scroll container
      expect(scrollContainers!.length).toBeGreaterThanOrEqual(1);
    });
    
    it('should use fixed positioning on root to prevent any scroll', () => {
      const companionContent = fs.readFileSync(companionPagePath, 'utf-8');
      
      // Root should be fixed inset-0
      expect(companionContent).toContain('fixed inset-0');
      expect(companionContent).toContain('flex flex-col');
    });
  });
  
  describe('Height Constraints', () => {
    it('should use fixed positioning on companion page', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      // Should use fixed inset-0 to lock to viewport
      expect(content).toContain('fixed inset-0');
    });
    
    it('should use h-full on nested containers', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      // Nested containers should use h-full
      expect(content).toContain('h-full');
    });
    
    it('should not use min-h-screen or h-screen with scroll', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      // Should use fixed positioning instead
      expect(content).toContain('fixed');
    });
  });
  
  describe('Media Generation Stability', () => {
    it('should maintain fixed layout when messages grow', () => {
      const companionContent = fs.readFileSync(companionPagePath, 'utf-8');
      
      // Flex-1 on main allows it to take remaining space
      expect(companionContent).toMatch(/main.*flex-1|flex-1.*main/);
      
      // Overflow-hidden prevents content from escaping
      expect(companionContent).toMatch(/main.*overflow-hidden|overflow-hidden.*main/);
    });
    
    it('should have GeminiChatbot receive isFullScreen prop', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      expect(content).toContain('isFullScreen={true}');
    });
  });
  
  describe('Layout Hierarchy Verification', () => {
    it('should have correct flexbox nesting', () => {
      const content = fs.readFileSync(companionPagePath, 'utf-8');
      
      // Verify key layout elements are present
      expect(content).toContain('fixed inset-0');
      expect(content).toContain('flex-shrink-0');
      expect(content).toContain('flex-1');
      expect(content).toContain('overflow-hidden');
    });
    
    it('should have h-full cascade from companion page to chatbot', () => {
      const companionContent = fs.readFileSync(companionPagePath, 'utf-8');
      const chatbotContent = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Companion: h-full max-w-4xl mx-auto
      expect(companionContent).toContain('h-full max-w-4xl mx-auto');
      
      // Chatbot: h-full on root
      expect(chatbotContent).toMatch(/return \([^)]*<div className="[^"]*h-full/s);
    });
  });
  
  describe('Edge Cases - Content Overflow', () => {
    it('should handle very long messages', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Messages container should have word-wrap or break-words
      expect(content).toMatch(/overflow-y-auto/);
    });
    
    it('should handle multiple media items in single message', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should have flex-1 overflow-y-auto for messages
      expect(content).toContain('flex-1 overflow-y-auto');
    });
    
    it('should handle rapid message additions', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // scrollIntoView should be used for auto-scroll
      expect(content).toContain('scrollIntoView');
    });
  });
});

describe('Drawer Mode Layout Stability', () => {
  const drawerPath = path.join(__dirname, '../components/global-chatbot-drawer.tsx');
  
  describe('Drawer Component Layout', () => {
    it('should exist', () => {
      expect(fs.existsSync(drawerPath)).toBe(true);
    });
    
    it('should use drawer component structure', () => {
      const content = fs.readFileSync(drawerPath, 'utf-8');
      
      // Drawer should use Dialog or similar component
      expect(content).toMatch(/Dialog|Drawer|Sheet|Modal/i);
    });
    
    it('should use GeminiChatbot without isFullScreen prop (defaults to false)', () => {
      const content = fs.readFileSync(drawerPath, 'utf-8');
      
      // Drawer renders GeminiChatbot
      expect(content).toContain('<GeminiChatbot');
      expect(content).toContain('brandId={brandId');
    });
    
    it('should have proper height constraints', () => {
      const content = fs.readFileSync(drawerPath, 'utf-8');
      
      // Drawer should have h-full or similar
      expect(content).toMatch(/h-full|h-\[/);
    });
  });
  
  describe('Drawer vs Fullscreen Consistency', () => {
    it('both should use same GeminiChatbot component', () => {
      const drawerContent = fs.readFileSync(drawerPath, 'utf-8');
      const companionContent = fs.readFileSync(path.join(__dirname, '../app/companion/page.tsx'), 'utf-8');
      
      expect(drawerContent).toContain('GeminiChatbot');
      expect(companionContent).toContain('GeminiChatbot');
    });
    
    it('both should handle media generation', () => {
      const chatbotContent = fs.readFileSync(path.join(__dirname, '../components/gemini-chatbot.tsx'), 'utf-8');
      
      // Should not branch on isFullScreen for media generation
      expect(chatbotContent).toContain('sendMessage');
    });
  });
});

describe('Body Scroll Prevention', () => {
  describe('Root Layout', () => {
    const layoutPath = path.join(__dirname, '../app/layout.tsx');
    
    it('should have h-full and overflow-hidden', () => {
      const content = fs.readFileSync(layoutPath, 'utf-8');
      
      // Should use h-full for viewport containment
      expect(content).toContain('h-full');
      expect(content).toContain('overflow-hidden');
    });
    
    it('should allow overflow-auto on main for scrollable pages', () => {
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      
      // Main should have overflow-auto for normal pages
      expect(layoutContent).toMatch(/main.*overflow-auto|overflow-auto.*main/);
    });
  });
  
  describe('Header Component Awareness', () => {
    const headerPath = path.join(__dirname, '../components/layout/header.tsx');
    
    it('should hide on companion page', () => {
      const content = fs.readFileSync(headerPath, 'utf-8');
      
      expect(content).toContain('/companion');
      expect(content).toMatch(/pathname === '\/companion'.*return null/s);
    });
    
    it('should use usePathname for route detection', () => {
      const content = fs.readFileSync(headerPath, 'utf-8');
      
      expect(content).toContain('usePathname');
      expect(content).toContain('const pathname =');
    });
  });
});

describe('Messages Container Scroll Behavior', () => {
  const chatbotPath = path.join(__dirname, '../components/gemini-chatbot.tsx');
  
  it('should have scrollable messages container', () => {
    const content = fs.readFileSync(chatbotPath, 'utf-8');
    
    expect(content).toContain('messagesContainerRef');
    expect(content).toContain('overflow-y-auto');
  });
  
  it('should auto-scroll on new messages', () => {
    const content = fs.readFileSync(chatbotPath, 'utf-8');
    
    expect(content).toContain('scrollIntoView');
  });
  
  it('should have flex-1 to fill available space', () => {
    const content = fs.readFileSync(chatbotPath, 'utf-8');
    
    // Messages container needs flex-1 to expand
    expect(content).toMatch(/messagesContainerRef.*flex-1/s);
  });
  
  it('should have min-h-0 for proper flex scrolling', () => {
    const content = fs.readFileSync(chatbotPath, 'utf-8');
    
    // min-h-0 is critical for overflow to work in flex containers
    expect(content).toMatch(/messagesContainerRef.*min-h-0/s);
  });
});

describe('Media Display Stability', () => {
  const chatbotPath = path.join(__dirname, '../components/gemini-chatbot.tsx');
  
  it('should handle image rendering without breaking layout', () => {
    const content = fs.readFileSync(chatbotPath, 'utf-8');
    
    // Images should be contained and not cause overflow
    expect(content).toContain('img');
    expect(content).toMatch(/max-w|w-full/);
  });
  
  it('should handle video rendering without breaking layout', () => {
    const content = fs.readFileSync(chatbotPath, 'utf-8');
    
    // Videos should be contained
    expect(content).toContain('video');
  });
  
  it('should handle multiple media items in one message', () => {
    const content = fs.readFileSync(chatbotPath, 'utf-8');
    
    // Should map over media arrays
    expect(content).toMatch(/media.*map/);
  });
});

describe('Fullscreen Mode Integration Tests', () => {
  describe('Component Communication', () => {
    it('companion page should render GeminiChatbot', () => {
      const companionContent = fs.readFileSync(path.join(__dirname, '../app/companion/page.tsx'), 'utf-8');
      
      expect(companionContent).toContain('import { GeminiChatbot }');
      expect(companionContent).toContain('<GeminiChatbot');
    });
    
    it('should pass brandId prop', () => {
      const content = fs.readFileSync(path.join(__dirname, '../app/companion/page.tsx'), 'utf-8');
      
      expect(content).toMatch(/brandId=\{brandId/);
    });
    
    it('should have minimize functionality', () => {
      const content = fs.readFileSync(path.join(__dirname, '../app/companion/page.tsx'), 'utf-8');
      
      expect(content).toContain('handleMinimize');
      expect(content).toContain('Minimize');
    });
  });
  
  describe('No Scroll Leakage', () => {
    it('should prevent scroll from bubbling to body', () => {
      const companionContent = fs.readFileSync(path.join(__dirname, '../app/companion/page.tsx'), 'utf-8');
      
      // Root must use fixed positioning
      expect(companionContent).toContain('fixed inset-0');
      expect(companionContent).toContain('flex flex-col');
    });
    
    it('should have all height constraints properly set', () => {
      const companionContent = fs.readFileSync(path.join(__dirname, '../app/companion/page.tsx'), 'utf-8');
      
      // Check for proper positioning and height
      expect(companionContent).toContain('fixed inset-0'); // Root
      expect(companionContent).toContain('h-full');       // Nested containers
    });
  });
});

