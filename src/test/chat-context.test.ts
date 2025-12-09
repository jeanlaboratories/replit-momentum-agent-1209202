import { describe, it, expect } from 'vitest';
import { formatSelectedContext } from '../lib/chat-context-utils';

describe('Chat Context Utils', () => {
  it('should format selected context correctly', () => {
    const selectedContext = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];
    const currentMessage = 'How are you?';
    const result = formatSelectedContext(selectedContext, currentMessage);
    expect(result).toContain('[User]: Hello');
    expect(result).toContain('[AI]: Hi there!');
    expect(result).toContain('Current Message: How are you?');
  });

  it('should return current message if no context', () => {
    const result = formatSelectedContext([], 'How are you?');
    expect(result).toBe('How are you?');
  });

  it('should return current message if context is undefined', () => {
    const result = formatSelectedContext(undefined as any, 'How are you?');
    expect(result).toBe('How are you?');
  });
});
