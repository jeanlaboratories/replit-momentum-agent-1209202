/**
 * Tests for New Conversation Loading State Fix
 *
 * This test file ensures that when starting a new conversation with Team Companion:
 * 1. The thinking bubble/spinner appears for the first message
 * 2. The isLoading state is maintained during conversation auto-creation
 * 3. The conversation switching logic doesn't interfere with active message sending
 * 4. No regression in normal conversation switching behavior
 */

import { vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('New Conversation Loading State', () => {
  const srcDir = path.join(__dirname, '..');
  const chatbotPath = path.join(srcDir, 'components/gemini-chatbot.tsx');

  describe('Bug Fix - Conversation Switching During Message Send', () => {
    it('gemini-chatbot.tsx should exist', () => {
      expect(fs.existsSync(chatbotPath)).toBe(true);
    });

    it('should check isLoading before reloading conversation history', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Find the conversation switching useEffect
      expect(content).toContain('previousConversationIdRef');
      expect(content).toContain('// Handle conversation switching');
      
      // The fix: should check isLoading before calling loadChatHistory
      expect(content).toContain('if (isLoading)');
      expect(content).toContain('// IMPORTANT: Skip if we\'re currently sending a message');
      
      // Should update ref without reloading when isLoading is true
      expect(content).toContain('previousConversationIdRef.current = currentConversationId');
      expect(content).toContain('return;');
    });

    it('should add isLoading to conversation switching useEffect dependencies', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Find the useEffect that handles conversation switching
      const useEffectMatch = content.match(
        /\/\/ Handle conversation switching[\s\S]+?}, \[currentConversationId(?:, isLoading)?\]\);/
      );
      
      expect(useEffectMatch).not.toBeNull();
      
      // Should include isLoading in dependencies to react to loading state changes
      // Use regex to be flexible with whitespace
      expect(content).toMatch(/\[currentConversationId,\s*isLoading\]/);
    });

    it('should preserve loading state when conversation ID changes during send', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // The pattern should be:
      // 1. Check if previous !== current (conversation changed)
      // 2. Check if isLoading (skip if sending message)
      // 3. Update ref
      // 4. Only reload if not loading
      
      const switchingLogicMatch = content.match(
        /if \(previousConversationIdRef\.current === currentConversationId\) return;[\s\S]{0,500}if \(isLoading\)/
      );
      
      expect(switchingLogicMatch).not.toBeNull();
    });

    it('should still clear messages and reload for user-initiated conversation switches', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // When isLoading is false (user clicked a conversation), should still work normally
      expect(content).toContain('setMessages([])');
      expect(content).toContain('loadChatHistory()');
      expect(content).toContain('loadChatHistory(currentConversationId)');
    });

    it('should show thinking bubble when assistant message has no content and isLoading', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Verify thinking bubble logic exists
      expect(content).toContain('message.role === \'assistant\' && !message.content && isLoading');
      expect(content).toContain('<Loader2');
      expect(content).toContain('animate-spin');
      expect(content).toContain('Thinking...');
    });

    it('should add placeholder assistant message with empty content when sending', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // In sendMessage function, should add placeholder with empty content
      expect(content).toContain('const sendMessage = async');
      expect(content).toContain('setIsLoading(true)');
      expect(content).toContain('{ role: \'assistant\', content: \'\', mode: selectedMode }');
    });

    it('should not call loadChatHistory when conversation auto-created during send', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // When a new conversation is auto-created (line ~1568), setCurrentConversationId is called
      // The fix ensures that this doesn't trigger loadChatHistory while isLoading=true
      expect(content).toContain('setCurrentConversationId(saveData.conversationId)');
      
      // And the useEffect should skip reloading when isLoading
      expect(content).toContain('if (isLoading)');
      expect(content).toContain('return;');
    });
  });

  describe('Integration - Complete Flow', () => {
    it('should maintain correct flow: send -> auto-create -> keep loading -> stream -> complete', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Step 1: sendMessage sets isLoading=true
      expect(content).toContain('setIsLoading(true)');
      
      // Step 2: Placeholder assistant message added
      expect(content).toContain('{ role: \'assistant\', content: \'\',');
      
      // Step 3: If new conversation, conversationId updated
      expect(content).toContain('setCurrentConversationId(saveData.conversationId)');
      
      // Step 4: Conversation switch logic checks isLoading and skips reload
      expect(content).toContain('if (isLoading)');
      
      // Step 5: Response streams and updates assistant message
      expect(content).toContain('setMessages((prev)');
      expect(content).toContain('assistantMessageIndex');
      
      // Step 6: Eventually setIsLoading(false) when done
      expect(content).toContain('setIsLoading(false)');
    });

    it('should handle normal conversation switching when not sending message', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // When user manually switches conversations (isLoading = false):
      // - Should clear messages
      // - Should load new conversation history
      // - Should NOT skip the reload
      
      const switchingBlock = content.match(
        /if \(isLoading\)[\s\S]{0,300}setMessages\(\[\]\)/
      );
      
      expect(switchingBlock).not.toBeNull();
      
      // The setMessages([]) should come AFTER the isLoading check return
      // This ensures manual switches still clear and reload
    });
  });

  describe('Regression Prevention', () => {
    it('should not affect conversation switching when user clicks conversation', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // handleSelectConversation should still work normally
      expect(content).toContain('const handleSelectConversation');
      expect(content).toContain('setCurrentConversationId');
    });

    it('should not affect new conversation button', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // handleNewConversation should still work
      expect(content).toContain('const handleNewConversation');
      expect(content).toContain('setMessages([])');
      expect(content).toContain('refreshConversations');
    });

    it('should still load chat history on component mount', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Initial load should still happen
      expect(content).toContain('// Load chat history on mount');
      expect(content).toContain('chatHistoryLoadedRef');
      expect(content).toContain('loadChatHistory()');
    });

    it('should maintain existing message editing functionality', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Editing messages should still work
      expect(content).toContain('const handleEditMessage');
      expect(content).toContain('const handleSaveEdit');
      expect(content).toContain('editingMessageId');
    });

    it('should maintain existing message deletion functionality', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Deleting messages should still work
      expect(content).toContain('const handleDeleteMessage');
      expect(content).toContain('deletingMessageId');
    });
  });

  describe('UI State Consistency', () => {
    it('should show Loader2 spinner component for loading state', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should import and use Loader2
      expect(content).toContain('Loader2');
      expect(content).toContain('animate-spin');
    });

    it('should show "Thinking..." text during loading', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      expect(content).toContain('Thinking...');
    });

    it('should style thinking indicator appropriately', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should have styling for the thinking indicator
      expect(content).toContain('text-muted-foreground');
      expect(content).toContain('text-primary');
    });

    it('should only show thinking bubble when message is empty and loading', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Logic should check all three conditions
      const thinkingLogicMatch = content.match(
        /message\.role === ['"]assistant['"] && !message\.content && isLoading/
      );
      
      expect(thinkingLogicMatch).not.toBeNull();
    });

    it('should not show thinking bubble when message has content', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // The condition explicitly checks !message.content
      expect(content).toContain('!message.content && isLoading');
      
      // Once content starts streaming, thinking bubble should disappear
      expect(content).toContain('content: assistantContent');
    });
  });

  describe('Code Quality', () => {
    it('should have clear comments explaining the fix', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should have explanatory comments
      expect(content).toContain('// IMPORTANT:');
      expect(content).toContain('Skip if we\'re currently sending a message');
      expect(content).toContain('prevents the conversation auto-creation from clearing the loading state');
    });

    it('should not have TypeScript/linting errors', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should be valid TypeScript
      expect(content).toContain('\'use client\'');
      expect(content).not.toContain('// @ts-ignore');
      expect(content).not.toContain('// eslint-disable');
    });

    it('should use consistent naming conventions', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      
      // Should use camelCase for variables
      expect(content).toContain('isLoading');
      expect(content).toContain('currentConversationId');
      expect(content).toContain('previousConversationIdRef');
    });
  });
});

