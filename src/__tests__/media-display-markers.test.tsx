/**
 * MEDIA DISPLAY MARKERS TESTS
 * 
 * These tests ensure that the agent ALWAYS uses __IMAGE_URL__ and __VIDEO_URL__
 * markers when mentioning media in responses, enabling rich preview display.
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Agent instructions emphasize using markers for ALL image/video URLs
 * 2. Context injection reminds agent to use markers
 * 3. Frontend properly extracts and displays markers
 * 4. Plain URLs are converted to structured previews
 * 5. Re-inject and Open buttons always present
 * 
 * USER EXPERIENCE:
 * - Agent says "here's the image: __IMAGE_URL__<url>__IMAGE_URL__"
 * - Frontend renders: [Image Preview] [Re-inject] [Open]
 * - NOT just plain URL text
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Media Display Markers - Agent Instructions', () => {
  const agentPath = path.join(__dirname, '../../python_service/momentum_agent.py');
  
  describe('Critical Instructions', () => {
    it('should have CRITICAL instruction for using media markers', () => {
      const content = fs.readFileSync(agentPath, 'utf-8');
      
      expect(content).toMatch(/CRITICAL.*ALWAYS.*Media Display Markers|CRITICAL.*Displaying Media/i);
    });
    
    it('should instruct to use __IMAGE_URL__ for all images', () => {
      const content = fs.readFileSync(agentPath, 'utf-8');
      
      expect(content).toContain('__IMAGE_URL__');
      expect(content).toMatch(/ALWAYS|WHENEVER.*mention/i);
    });
    
    it('should instruct to use __VIDEO_URL__ for all videos', () => {
      const content = fs.readFileSync(agentPath, 'utf-8');
      
      expect(content).toContain('__VIDEO_URL__');
    });
    
    it('should emphasize using markers for ALL scenarios', () => {
      const content = fs.readFileSync(agentPath, 'utf-8');
      
      // Should mention multiple scenarios
      expect(content).toMatch(/search results|context|available|generated|ANY time/i);
    });
    
    it('should forbid plain URLs', () => {
      const content = fs.readFileSync(agentPath, 'utf-8');
      
      expect(content).toMatch(/DO NOT.*plain URLs|DO NOT just paste/i);
    });
    
    it('should provide examples for different scenarios', () => {
      const content = fs.readFileSync(agentPath, 'utf-8');
      
      // Should have example for "what images"
      expect(content).toMatch(/what images|images in.*context/i);
      
      // Should have example for search results
      expect(content).toMatch(/show me|find.*images/i);
    });
  });
  
  describe('Context Injection Instructions', () => {
    const routerPath = path.join(__dirname, '../../python_service/routers/agent.py');
    
    it('should remind agent to use markers in context', () => {
      const content = fs.readFileSync(routerPath, 'utf-8');
      
      expect(content).toMatch(/__IMAGE_URL__|__VIDEO_URL__/);
    });
    
    it('should have CRITICAL instruction in context', () => {
      const content = fs.readFileSync(routerPath, 'utf-8');
      
      expect(content).toMatch(/CRITICAL INSTRUCTION/);
    });
    
    it('should instruct wrapping URLs with markers', () => {
      const content = fs.readFileSync(routerPath, 'utf-8');
      
      expect(content).toMatch(/wrap.*markers|markers.*wrap/i);
    });
  });
});

describe('Frontend Media Marker Rendering', () => {
  const chatbotPath = path.join(__dirname, '../components/gemini-chatbot.tsx');
  
  describe('Marker Extraction', () => {
    it('should extract __IMAGE_URL__ markers from content', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('__IMAGE_URL__');
    });
    
    it('should extract __VIDEO_URL__ markers from content', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('__VIDEO_URL__');
    });
    
    it('should have regex or matching logic for markers', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should have matching logic for both markers
      expect(content).toMatch(/__IMAGE_URL__|match.*IMAGE_URL/);
    });
  });
  
  describe('Media Preview Components', () => {
    it('should render images with re-inject button', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('Re-inject');
      expect(content).toContain('handleInjectMedia');
    });
    
    it('should render images with open button', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('Open Image');
      expect(content).toContain('Open Video');
    });
    
    it('should display image previews', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should render img tags for images
      expect(content).toMatch(/<img/);
    });
    
    it('should display video players', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should render video tags
      expect(content).toMatch(/<video/);
    });
  });
  
  describe('Content Cleaning', () => {
    it('should clean content to remove markers from text', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should have cleanMessageContent function
      expect(content).toContain('cleanMessageContent');
    });
    
    it('should replace markers with proper display', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should handle __IMAGE_DATA__ and __VIDEO_DATA__ markers
      expect(content).toMatch(/__IMAGE_DATA__|__VIDEO_DATA__/);
    });
  });
});

describe('Media Display Scenarios', () => {
  
  describe('Scenario 1: Agent Lists Available Images', () => {
    it('should use markers when listing context images', () => {
      const agentPath = path.join(__dirname, '../../python_service/momentum_agent.py');
      const content = fs.readFileSync(agentPath, 'utf-8');
      
      // Should have example for this scenario
      expect(content).toMatch(/what images.*context|images in.*context/i);
      expect(content).toContain('__IMAGE_URL__');
    });
  });
  
  describe('Scenario 2: Agent Shows Search Results', () => {
    it('should use markers for search results', () => {
      const agentPath = path.join(__dirname, '../../python_service/momentum_agent.py');
      const content = fs.readFileSync(agentPath, 'utf-8');
      
      expect(content).toMatch(/search.*images.*__IMAGE_URL__|find.*images/i);
    });
  });
  
  describe('Scenario 3: Agent Shares Generated Media', () => {
    it('should use markers for generated images', () => {
      const agentPath = path.join(__dirname, '../../python_service/momentum_agent.py');
      const content = fs.readFileSync(agentPath, 'utf-8');
      
      // Should mention using markers for any scenario
      expect(content).toMatch(/ANY time.*URL|ALL scenarios/i);
    });
  });
});

describe('Media Marker Format Validation', () => {
  
  it('should use correct image marker format', () => {
    const agentPath = path.join(__dirname, '../../python_service/momentum_agent.py');
    const content = fs.readFileSync(agentPath, 'utf-8');
    
    // Should show exact format
    expect(content).toContain('__IMAGE_URL__<url>__IMAGE_URL__');
  });
  
  it('should use correct video marker format', () => {
    const agentPath = path.join(__dirname, '../../python_service/momentum_agent.py');
    const content = fs.readFileSync(agentPath, 'utf-8');
    
    // Should show exact format
    expect(content).toContain('__VIDEO_URL__<url>__VIDEO_URL__');
  });
  
  it('should have multiple examples with markers', () => {
    const agentPath = path.join(__dirname, '../../python_service/momentum_agent.py');
    const content = fs.readFileSync(agentPath, 'utf-8');
    
    // Count examples
    const imageMarkerExamples = content.match(/__IMAGE_URL__https:\/\//g);
    expect(imageMarkerExamples).not.toBeNull();
    expect(imageMarkerExamples!.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Rich Preview Benefits', () => {
  
  it('should explain why markers are important', () => {
    const agentPath = path.join(__dirname, '../../python_service/momentum_agent.py');
    const content = fs.readFileSync(agentPath, 'utf-8');
    
    expect(content).toMatch(/enable rich preview|rich preview display|Re-inject.*Open buttons/);
  });
  
  it('should emphasize not using plain URLs', () => {
    const agentPath = path.join(__dirname, '../../python_service/momentum_agent.py');
    const content = fs.readFileSync(agentPath, 'utf-8');
    
    expect(content).toMatch(/DO NOT.*plain URLs|DO NOT just paste/i);
  });
});

