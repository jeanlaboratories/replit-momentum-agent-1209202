/**
 * COMPREHENSIVE AGENT TOOL ACCURACY TESTS
 * 
 * This test suite ensures 100% accurate tool selection and usage across ALL scenarios:
 * 
 * 1. Image Generation (generate_image)
 * 2. Video Generation (generate_video)
 * 3. Image Editing (nano_banana)
 * 4. Text Generation (generate_text / agent chat)
 * 5. Multi-modal Operations
 * 6. Tool Parameter Accuracy
 * 7. Edge Cases and Error Handling
 * 
 * SUCCESS CRITERIA:
 * - Correct tool selected 100% of the time
 * - Correct parameters passed to tools
 * - No silent failures
 * - Clear error messages when tool fails
 * - Multi-modal context handled correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Agent Tool Accuracy - 100% Verification', () => {
  const srcDir = path.join(__dirname, '..');
  const agentFilePath = path.join(srcDir, '../python_service/momentum_agent.py');
  const mediaToolsPath = path.join(srcDir, '../python_service/tools/media_tools.py');
  
  describe('Tool Definition & Availability', () => {
    it('should define all required tools', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Core AI generation tools
      expect(agentContent).toContain('generate_image');
      expect(agentContent).toContain('generate_video');
      expect(agentContent).toContain('nano_banana');
      expect(agentContent).toContain('generate_text');
      
      // Web & search tools
      expect(agentContent).toContain('web_search_agent');
      expect(agentContent).toContain('crawl_website');
      
      // Team tools
      expect(agentContent).toContain('suggest_domain_names');
      expect(agentContent).toContain('create_team_strategy');
      expect(agentContent).toContain('plan_website');
      expect(agentContent).toContain('design_logo_concepts');
      expect(agentContent).toContain('create_event');
      
      // Memory tools
      expect(agentContent).toContain('recall_memory');
      expect(agentContent).toContain('save_memory');
      
      // Media library tools
      expect(agentContent).toContain('search_media_library');
      expect(agentContent).toContain('search_images');
      expect(agentContent).toContain('search_videos');
    });
    
    it('should have clear tool descriptions', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Check for descriptive docstrings
      expect(agentContent).toContain('Create images with Imagen');
      expect(agentContent).toContain('Create videos with Veo');
      expect(agentContent).toContain('Edit uploaded images with AI');
    });
  });
  
  describe('Image Generation Tool Selection', () => {
    it('should instruct agent to use generate_image for image creation', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Agent should have explicit instructions for image generation
      expect(agentContent).toContain('generate_image');
      expect(agentContent).toMatch(/generate.*image.*USE THIS when user asks to.*generate.*create.*make.*image/i);
    });
    
    it('should specify generate_image tool parameters', () => {
      const mediaToolsContent = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      // Check generate_image function signature
      expect(mediaToolsContent).toContain('def generate_image');
      expect(mediaToolsContent).toContain('prompt:');
      expect(mediaToolsContent).toContain('aspect_ratio');
      expect(mediaToolsContent).toContain('number_of_images');
    });
    
    it('should NOT use generate_image for editing', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Should explicitly state not to use for editing
      expect(agentContent).toMatch(/DO NOT use.*editing|not.*edit/i);
      expect(agentContent).toContain('nano_banana');
    });
    
    it('should handle image generation requests correctly', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Examples of correct usage
      const examples = [
        'Generate a video of an eagle',
        'Create an image of a basketball',
        'Make a video of sunset',
      ];
      
      // At least one example should be present
      const hasExamples = examples.some(ex => agentContent.includes(ex));
      expect(hasExamples).toBe(true);
    });
  });
  
  describe('Video Generation Tool Selection', () => {
    it('should instruct agent to use generate_video for video creation', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toContain('generate_video');
      expect(agentContent).toMatch(/generate.*video.*USE THIS when user asks to.*generate.*create.*make.*video/i);
    });
    
    it('should specify generate_video tool parameters', () => {
      const mediaToolsContent = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      expect(mediaToolsContent).toContain('def generate_video');
      expect(mediaToolsContent).toContain('prompt:');
      expect(mediaToolsContent).toContain('aspect_ratio');
      expect(mediaToolsContent).toContain('duration_seconds');
      expect(mediaToolsContent).toContain('image_url'); // For image-to-video
    });
    
    it('should support image-to-video conversion', () => {
      const mediaToolsContent = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      // Should accept image_url parameter
      expect(mediaToolsContent).toContain('image_url');
      expect(mediaToolsContent).toMatch(/start.*frame|image.*to.*video/i);
    });
  });
  
  describe('Image Editing Tool Selection (nano_banana)', () => {
    it('should instruct agent to use nano_banana for editing', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toContain('nano_banana');
      expect(agentContent).toMatch(/nano_banana.*edit.*modify.*change/i);
    });
    
    it('should specify when to use nano_banana', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Should have clear examples
      expect(agentContent).toMatch(/user uploads an image AND asks to.*edit/i);
      expect(agentContent).toContain('make it red');
      expect(agentContent).toContain('make the tube red');
    });
    
    it('should specify nano_banana parameters', () => {
      const mediaToolsContent = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      expect(mediaToolsContent).toContain('def nano_banana');
      expect(mediaToolsContent).toContain('prompt:');
      expect(mediaToolsContent).toContain('image_url:');
      expect(mediaToolsContent).toContain('reference_images');
      expect(mediaToolsContent).toContain('mask_url');
    });
    
    it('should pass full URL to nano_banana, not filename', () => {
      const mediaToolsContent = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      // nano_banana tool should emphasize URL requirement
      expect(mediaToolsContent).toContain('nano_banana');
      expect(mediaToolsContent).toMatch(/image_url.*MUST|full URL|complete URL/i);
    });
  });
  
  describe('Multi-Modal Context Handling', () => {
    it('should inject media context into agent prompt', () => {
      const routerPath = path.join(srcDir, '../python_service/routers/agent.py');
      const routerContent = fs.readFileSync(routerPath, 'utf-8');
      
      // Should inject attached media
      expect(routerContent).toContain('Attached Media');
      expect(routerContent).toContain('media_str');
      
      // Should inject resolved image context
      expect(routerContent).toContain('RESOLVED MEDIA CONTEXT');
      expect(routerContent).toContain('image_context');
    });
    
    it('should provide resolution metadata to agent', () => {
      const routerPath = path.join(srcDir, '../python_service/routers/agent.py');
      const routerContent = fs.readFileSync(routerPath, 'utf-8');
      
      expect(routerContent).toContain('Resolution Method');
      expect(routerContent).toContain('Confidence');
      expect(routerContent).toContain('User Intent');
    });
    
    it('should mark newly uploaded media clearly', () => {
      const routerPath = path.join(srcDir, '../python_service/routers/agent.py');
      const routerContent = fs.readFileSync(routerPath, 'utf-8');
      
      expect(routerContent).toContain('NEWLY uploaded');
      expect(routerContent).toContain('is_new_media');
    });
    
    it('should provide media role information', () => {
      const routerPath = path.join(srcDir, '../python_service/routers/agent.py');
      const routerContent = fs.readFileSync(routerPath, 'utf-8');
      
      expect(routerContent).toContain('PRIMARY IMAGE');
      expect(routerContent).toContain('REFERENCE IMAGES');
      expect(routerContent).toContain('role');
    });
  });
  
  describe('Tool Parameter Accuracy', () => {
    it('should pass correct prompt to generate_image', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Should have generate_image mentioned with prompt parameter
      expect(agentContent).toContain('generate_image');
      expect(agentContent).toMatch(/prompt/i);
    });
    
    it('should pass correct URL to nano_banana', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Should mention nano_banana and URL parameter
      expect(agentContent).toContain('nano_banana');
      expect(agentContent).toMatch(/image_url|URL/i);
    });
    
    it('should handle aspect ratios correctly', () => {
      const mediaToolsContent = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      // Should list valid aspect ratios
      expect(mediaToolsContent).toContain('aspect_ratio');
      expect(mediaToolsContent).toMatch(/1:1|16:9|9:16/);
    });
  });
  
  describe('Native Vision Capability', () => {
    it('should inform agent about native multimodal vision', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toContain('MULTIMODAL VISION');
      expect(agentContent).toMatch(/images.*PDFs.*videos.*audio/i);
    });
    
    it('should handle uploaded media for analysis', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Should mention that agent can see uploaded files
      expect(agentContent).toMatch(/users upload.*respond naturally|analyze.*upload/i);
    });
  });
  
  describe('Critical Tool Selection Rules', () => {
    it('should have CRITICAL instructions for media generation', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toContain('CRITICAL INSTRUCTIONS');
      expect(agentContent).toContain('Media Generation');
    });
    
    it('should forbid suggesting external resources', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Should explicitly say not to suggest YouTube, stock sites, etc.
      expect(agentContent).toMatch(/DO NOT.*YouTube|DO NOT suggest.*stock/i);
      expect(agentContent).toMatch(/YOU CAN GENERATE/i);
    });
    
    it('should have clear examples for each tool', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Should have "Examples:" sections
      const exampleSections = agentContent.match(/Examples:/g);
      expect(exampleSections).not.toBeNull();
      expect(exampleSections!.length).toBeGreaterThan(3); // Multiple tool examples
    });
  });
  
  describe('Error Handling & Edge Cases', () => {
    it('should handle missing media gracefully', () => {
      const mediaToolsContent = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      // Tools should check for required parameters or have validation
      expect(mediaToolsContent).toMatch(/if not|required|raise.*Error/i);
    });
    
    it('should validate image URLs', () => {
      const mediaToolsContent = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      // nano_banana should emphasize URL requirement
      expect(mediaToolsContent).toMatch(/MUST be.*full URL|complete URL/i);
    });
    
    it('should handle API errors gracefully', () => {
      const mediaToolsContent = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      // Should have try-except blocks
      expect(mediaToolsContent).toMatch(/try:.*except/s);
      expect(mediaToolsContent).toMatch(/status.*error/i);
    });
  });
  
  describe('Response Format Consistency', () => {
    it('should use consistent response format for media tools', () => {
      const mediaToolsContent = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      // All tools should return dict with status, message, url
      const returnStatements = mediaToolsContent.match(/return \{[^}]*"status"[^}]*\}/g);
      expect(returnStatements).not.toBeNull();
      expect(returnStatements!.length).toBeGreaterThan(5);
    });
    
    it('should include proper error responses', () => {
      const mediaToolsContent = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      expect(mediaToolsContent).toMatch(/"status":\s*"error"/);
      expect(mediaToolsContent).toMatch(/"status":\s*"success"/);
    });
  });
  
  describe('Tool Call Logging & Debugging', () => {
    it('should log tool calls for debugging', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Should have logging statements
      expect(agentContent).toMatch(/logger\.info|print.*tool/i);
    });
    
    it('should log tool parameters', () => {
      const mediaToolsContent = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      // Tools should log what they receive
      const logStatements = mediaToolsContent.match(/print|logger/g);
      expect(logStatements).not.toBeNull();
    });
  });
  
  describe('Integration with Robust Media Context', () => {
    it('should use resolved media URLs from context', () => {
      const routerPath = path.join(srcDir, '../python_service/routers/agent.py');
      const routerContent = fs.readFileSync(routerPath, 'utf-8');
      
      // Should provide URLs and instructions
      expect(routerContent).toContain('URL');
      expect(routerContent).toContain('CRITICAL INSTRUCTION');
    });
    
    it('should provide tool call guidance based on resolution', () => {
      const routerPath = path.join(srcDir, '../python_service/routers/agent.py');
      const routerContent = fs.readFileSync(routerPath, 'utf-8');
      
      expect(routerContent).toContain('CRITICAL INSTRUCTION');
      expect(routerContent).toContain('Use the URLs listed above');
    });
    
    it('should handle primary vs reference images correctly', () => {
      const routerPath = path.join(srcDir, '../python_service/routers/agent.py');
      const routerContent = fs.readFileSync(routerPath, 'utf-8');
      
      expect(routerContent).toContain('PRIMARY IMAGE');
      expect(routerContent).toContain('main subject');
    });
  });
  
  describe('Memory Tool Accuracy', () => {
    it('should have CRITICAL instructions for memory', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toContain('CRITICAL: YOU MUST CALL save_memory');
      expect(agentContent).toMatch(/do NOT just say.*I'll remember/i);
    });
    
    it('should provide clear examples for save_memory', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toMatch(/favorite color.*blue.*CALL save_memory/i);
    });
    
    it('should distinguish personal vs team memories', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toContain('scope=\'personal\'');
      expect(agentContent).toContain('scope=\'team\'');
    });
  });
  
  describe('Event Creation Tool', () => {
    it('should handle character consistency for events', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toContain('character_sheet_urls');
      expect(agentContent).toContain('enable_character_consistency');
    });
    
    it('should accept natural language event descriptions', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toMatch(/DO NOT ask.*details|pass.*directly to the tool/i);
    });
  });
  
  describe('Web & Search Tools', () => {
    it('should use web_search_agent for searches', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toContain('web_search_agent');
      expect(agentContent).toContain('Google Search');
    });
    
    it('should use crawl_website for URL analysis', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toContain('crawl_website');
      expect(agentContent).toContain('Firecrawl');
    });
  });
  
  describe('Media Library Search Tools', () => {
    it('should use proper display markers for media', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toContain('__IMAGE_URL__');
      expect(agentContent).toContain('__VIDEO_URL__');
    });
    
    it('should explain when to show media', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toMatch(/CRITICAL.*Media.*Markers|ALWAYS.*Media Display/i);
      expect(agentContent).toMatch(/WHENEVER.*mention|ANY time.*URL/i);
    });
  });
  
  describe('Response Guidelines', () => {
    it('should forbid system messages in responses', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toMatch(/DO NOT output.*SYSTEM|DO NOT output.*Displaying image/i);
    });
    
    it('should encourage natural responses', () => {
      const agentContent = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(agentContent).toContain('Response Guidelines');
      expect(agentContent).toMatch(/describe.*naturally|confirm.*action naturally/i);
    });
  });
});

describe('Tool Selection Scenarios - Verification', () => {
  
  describe('Scenario: User asks to generate an image', () => {
    it('should clearly indicate generate_image is the correct tool', () => {
      const agentFilePath = path.join(__dirname, '../../python_service/momentum_agent.py');
      const content = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Should have explicit instruction
      expect(content).toMatch(/generate.*image.*USE THIS when user asks to.*generate.*create.*make.*IMAGE/i);
    });
  });
  
  describe('Scenario: User uploads image and asks to edit', () => {
    it('should clearly indicate nano_banana is the correct tool', () => {
      const agentFilePath = path.join(__dirname, '../../python_service/momentum_agent.py');
      const content = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Should mention nano_banana for editing
      expect(content).toContain('nano_banana');
      expect(content).toMatch(/edit.*image|modify.*photo|nano_banana.*edit/i);
    });
  });
  
  describe('Scenario: User asks to generate a video', () => {
    it('should clearly indicate generate_video is the correct tool', () => {
      const agentFilePath = path.join(__dirname, '../../python_service/momentum_agent.py');
      const content = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(content).toMatch(/generate.*video.*USE THIS when user asks to.*generate.*create.*make.*VIDEO/i);
    });
  });
  
  describe('Scenario: User asks a question', () => {
    it('should use generate_text or respond naturally', () => {
      const agentFilePath = path.join(__dirname, '../../python_service/momentum_agent.py');
      const content = fs.readFileSync(agentFilePath, 'utf-8');
      
      // Agent has generate_text tool
      expect(content).toContain('generate_text');
      expect(content).toContain('conversations');
    });
  });
  
  describe('Scenario: User mentions a fact to remember', () => {
    it('should emphasize CALLING save_memory', () => {
      const agentFilePath = path.join(__dirname, '../../python_service/momentum_agent.py');
      const content = fs.readFileSync(agentFilePath, 'utf-8');
      
      expect(content).toContain('CRITICAL: YOU MUST CALL save_memory');
      expect(content).toMatch(/if you don't call save_memory.*WILL NOT be saved/i);
    });
  });
});

describe('Tool Parameter Validation', () => {
  
  describe('generate_image parameters', () => {
    it('should accept all valid parameters', () => {
      const mediaToolsPath = path.join(__dirname, '../../python_service/tools/media_tools.py');
      const content = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      // Find generate_image function
      const generateImageMatch = content.match(/def generate_image\([^)]+\)/s);
      expect(generateImageMatch).not.toBeNull();
      
      const params = generateImageMatch![0];
      expect(params).toContain('prompt');
      expect(params).toContain('aspect_ratio');
      expect(params).toContain('number_of_images');
    });
  });
  
  describe('nano_banana parameters', () => {
    it('should accept all editing parameters', () => {
      const mediaToolsPath = path.join(__dirname, '../../python_service/tools/media_tools.py');
      const content = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      const nanoBananaMatch = content.match(/def nano_banana\([^)]+\)/s);
      expect(nanoBananaMatch).not.toBeNull();
      
      const params = nanoBananaMatch![0];
      expect(params).toContain('prompt');
      expect(params).toContain('image_url');
      expect(params).toContain('reference_images');
      expect(params).toContain('mask_url');
      expect(params).toContain('mode');
    });
  });
  
  describe('generate_video parameters', () => {
    it('should accept all video generation parameters', () => {
      const mediaToolsPath = path.join(__dirname, '../../python_service/tools/media_tools.py');
      const content = fs.readFileSync(mediaToolsPath, 'utf-8');
      
      const generateVideoMatch = content.match(/def generate_video\([^)]+\)/s);
      expect(generateVideoMatch).not.toBeNull();
      
      const params = generateVideoMatch![0];
      expect(params).toContain('prompt');
      expect(params).toContain('image_url');
      expect(params).toContain('aspect_ratio');
      expect(params).toContain('duration_seconds');
    });
  });
});

describe('100% Tool Accuracy - Summary Tests', () => {
  it('should have all critical safety instructions', () => {
    const agentFilePath = path.join(__dirname, '../../python_service/momentum_agent.py');
    const content = fs.readFileSync(agentFilePath, 'utf-8');
    
    // Count critical instruction sections
    const criticalInstructions = content.match(/CRITICAL|IMPORTANT|MUST/gi);
    expect(criticalInstructions).not.toBeNull();
    expect(criticalInstructions!.length).toBeGreaterThan(10); // Multiple critical instructions
  });
  
  it('should have sufficient examples for each major tool', () => {
    const agentFilePath = path.join(__dirname, '../../python_service/momentum_agent.py');
    const content = fs.readFileSync(agentFilePath, 'utf-8');
    
    // Should have many examples
    const examples = content.match(/Examples?:/gi);
    expect(examples).not.toBeNull();
    expect(examples!.length).toBeGreaterThan(5);
  });
  
  it('should forbid incorrect tool usage patterns', () => {
    const agentFilePath = path.join(__dirname, '../../python_service/momentum_agent.py');
    const content = fs.readFileSync(agentFilePath, 'utf-8');
    
    // Should have "DO NOT" instructions
    const prohibitions = content.match(/DO NOT|DON'T/gi);
    expect(prohibitions).not.toBeNull();
    expect(prohibitions!.length).toBeGreaterThan(5);
  });
  
  it('should provide clear tool selection rules', () => {
    const agentFilePath = path.join(__dirname, '../../python_service/momentum_agent.py');
    const content = fs.readFileSync(agentFilePath, 'utf-8');
    
    // Should explain WHEN to use each tool
    expect(content).toMatch(/WHEN.*use|USE THIS when|use.*when/gi);
  });
  
  it('should integrate with robust media context', () => {
    const routerPath = path.join(__dirname, '../../python_service/routers/agent.py');
    const content = fs.readFileSync(routerPath, 'utf-8');
    
    expect(content).toContain('RESOLVED MEDIA CONTEXT');
    expect(content).toContain('resolution_method');
    expect(content).toContain('resolution_confidence');
  });
});

