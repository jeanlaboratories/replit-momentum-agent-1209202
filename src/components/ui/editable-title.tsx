'use client';

import * as React from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface EditableTitleProps {
  /** Current title value */
  value: string;
  /** Callback when title is saved */
  onSave: (newTitle: string) => Promise<void> | void;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Additional class names for the container */
  className?: string;
  /** Class names for the title text when not editing */
  titleClassName?: string;
  /** Placeholder text when title is empty */
  placeholder?: string;
  /** Minimum length for title */
  minLength?: number;
  /** Maximum length for title */
  maxLength?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * EditableTitle component for inline title editing.
 * Click the pencil icon to enter edit mode, then save or cancel.
 */
export function EditableTitle({
  value,
  onSave,
  disabled = false,
  className,
  titleClassName,
  placeholder = 'Untitled',
  minLength = 1,
  maxLength = 200,
  size = 'md',
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Update editValue when value prop changes
  React.useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(value);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value);
    setError(null);
  };

  const handleSave = async () => {
    const trimmedValue = editValue.trim();

    // Validation
    if (trimmedValue.length < minLength) {
      setError(`Title must be at least ${minLength} character${minLength > 1 ? 's' : ''}`);
      return;
    }

    if (trimmedValue.length > maxLength) {
      setError(`Title must be less than ${maxLength} characters`);
      return;
    }

    // Skip save if unchanged
    if (trimmedValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch (err) {
      setError('Failed to save title');
      console.error('EditableTitle save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const sizeClasses = {
    sm: {
      text: 'text-sm',
      input: 'h-7 text-sm',
      button: 'h-6 w-6',
      icon: 'h-3 w-3',
    },
    md: {
      text: 'text-base',
      input: 'h-9 text-base',
      button: 'h-7 w-7',
      icon: 'h-4 w-4',
    },
    lg: {
      text: 'text-xl font-semibold',
      input: 'h-10 text-lg',
      button: 'h-8 w-8',
      icon: 'h-4 w-4',
    },
  };

  const sizes = sizeClasses[size];

  if (isEditing) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            placeholder={placeholder}
            maxLength={maxLength}
            className={cn(sizes.input, 'flex-1')}
            aria-label="Edit title"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            disabled={isSaving}
            className={cn(sizes.button, 'text-green-600 hover:text-green-700 hover:bg-green-100')}
            aria-label="Save title"
          >
            {isSaving ? (
              <Loader2 className={cn(sizes.icon, 'animate-spin')} />
            ) : (
              <Check className={sizes.icon} />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            disabled={isSaving}
            className={cn(sizes.button, 'text-muted-foreground hover:text-destructive hover:bg-destructive/10')}
            aria-label="Cancel editing"
          >
            <X className={sizes.icon} />
          </Button>
        </div>
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('group flex items-center gap-2', className)}>
      <span className={cn(sizes.text, titleClassName)}>
        {value || <span className="text-muted-foreground italic">{placeholder}</span>}
      </span>
      {!disabled && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleStartEdit}
          className={cn(
            sizes.button,
            'opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground'
          )}
          aria-label="Edit title"
        >
          <Pencil className={sizes.icon} />
        </Button>
      )}
    </div>
  );
}
