'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getUserInitials } from '@/lib/utils/comment-utils';
import { MentionUser } from '@/app/actions/get-team-members-for-mentions';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  teamMembers: MentionUser[];
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  className,
  maxLength,
  autoFocus,
  disabled,
  teamMembers,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy
}: MentionTextareaProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionPosition, setMentionPosition] = useState<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);

  // Filter team members based on search
  const filteredMembers = teamMembers.filter(member =>
    member.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    member.email.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Detect @ mentions
  useEffect(() => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's a space after @ (which would end the mention)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionSearch(textAfterAt);
        setMentionPosition(lastAtIndex);
        setShowMentions(true);
        setSelectedIndex(0);
        return;
      }
    }
    
    setShowMentions(false);
  }, [value]);

  const insertMention = (member: MentionUser) => {
    const beforeMention = value.substring(0, mentionPosition);
    const afterCursor = value.substring(textareaRef.current?.selectionStart || 0);
    const newValue = `${beforeMention}@${member.name} ${afterCursor}`;
    onChange(newValue);
    setShowMentions(false);
    
    // Set cursor position after the mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + member.name.length + 2;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentions || filteredMembers.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredMembers.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        break;
      case 'Enter':
      case 'Tab':
        if (showMentions) {
          e.preventDefault();
          insertMention(filteredMembers[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowMentions(false);
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (mentionListRef.current && showMentions) {
      const selectedElement = mentionListRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, showMentions]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        maxLength={maxLength}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
      />

      {showMentions && filteredMembers.length > 0 && (
        <div
          ref={mentionListRef}
          className="mention-dropdown-premium absolute z-50 w-full max-w-sm rounded-xl max-h-64 overflow-y-auto mt-2 animate-comment-slide-in"
          role="listbox"
          aria-label="Team member suggestions"
        >
          <div className="p-1.5">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium">
              Team Members
            </div>
            {filteredMembers.map((member, index) => (
              <button
                key={member.id}
                type="button"
                onClick={() => insertMention(member)}
                className={`mention-item-premium w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer ${
                  index === selectedIndex ? 'selected' : ''
                }`}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <div className="comment-avatar-ring flex-shrink-0">
                  <Avatar className="h-9 w-9 ring-2 ring-primary/10 ring-offset-1 ring-offset-background">
                    <AvatarImage src={member.photoURL} alt={member.name} />
                    <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-accent/20 text-foreground font-medium">
                      {getUserInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">{member.name}</div>
                  <div className="text-xs text-muted-foreground/60 truncate">{member.email}</div>
                </div>
                {index === selectedIndex && (
                  <div className="flex-shrink-0 text-[10px] text-primary/60 bg-primary/10 px-2 py-0.5 rounded-full">
                    Enter
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
