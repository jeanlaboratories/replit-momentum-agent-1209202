import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GeneratedContentCard from '../generated-content-card';
import type { GeneratedContentBlock, BrandProfile } from '@/lib/types';
import { generateEditedImage } from '@/ai/flows/generate-edited-image';

// Mock dependencies
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/app/actions', () => ({
  generateImageAction: vi.fn(),
  regenerateAdCopyAction: vi.fn(),
  regenerateImagePromptAction: vi.fn(),
}));

vi.mock('@/ai/flows/generate-edited-image', () => ({
  generateEditedImage: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

// Mock Job Queue context
const mockAddJob = vi.fn(() => 'mock-job-id');
const mockStartJob = vi.fn();
const mockSetProgress = vi.fn();
const mockCompleteJob = vi.fn();
const mockFailJob = vi.fn();

vi.mock('@/contexts/job-queue-context', () => ({
  useJobQueue: () => ({
    state: { jobs: [], isExpanded: false, isPanelVisible: true },
    addJob: mockAddJob,
    updateJob: vi.fn(),
    removeJob: vi.fn(),
    clearCompleted: vi.fn(),
    cancelJob: vi.fn(),
    startJob: mockStartJob,
    completeJob: mockCompleteJob,
    failJob: mockFailJob,
    setProgress: mockSetProgress,
    toggleExpanded: vi.fn(),
    setExpanded: vi.fn(),
    setPanelVisible: vi.fn(),
    getActiveJobs: vi.fn(() => []),
    getCompletedJobs: vi.fn(() => []),
    getJobById: vi.fn(),
    hasActiveJobs: vi.fn(() => false),
    isJobStalled: vi.fn(() => false),
    getStalledJobs: vi.fn(() => []),
  }),
}));

describe('GeneratedContentCard', () => {
  const mockBrandProfile: BrandProfile = {
    summary: 'A test brand summary',
    images: [],
    videos: [],
    documents: [],
  };

  const mockAvailableMedia = {
    images: [],
    videos: [],
  };

  const defaultProps = {
    brandProfile: mockBrandProfile,
    brandId: 'test-brand',
    brandName: 'Test Brand',
    availableMedia: mockAvailableMedia,
    mediaLoading: false,
    onContentChange: vi.fn(),
    onImagePromptChange: vi.fn(),
    onImageUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Delete functionality', () => {
    it('should show delete button on hover when onDelete is provided', () => {
      const mockBlock: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={mockBlock}
          onDelete={vi.fn()}
        />
      );

      // The delete button should exist (even if invisible until hover)
      const deleteButton = screen.getByRole('button', { name: /delete content block/i });
      expect(deleteButton).toBeInTheDocument();
    });

    it('should not show delete button when onDelete is not provided', () => {
      const mockBlock: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={mockBlock}
        />
      );

      const deleteButton = screen.queryByRole('button', { name: /delete content block/i });
      expect(deleteButton).not.toBeInTheDocument();
    });

    it('should call onDelete immediately for empty blocks without confirmation', async () => {
      const mockOnDelete = vi.fn();
      const emptyBlock: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={emptyBlock}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete content block/i });
      await userEvent.click(deleteButton);

      // Should call onDelete immediately without showing confirmation dialog
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should show confirmation dialog for blocks with ad copy', async () => {
      const mockOnDelete = vi.fn();
      const blockWithContent: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: 'This is some ad copy content',
        imagePrompt: '',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithContent}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete content block/i });
      await userEvent.click(deleteButton);

      // Should show confirmation dialog
      expect(screen.getByText('Delete Content Block?')).toBeInTheDocument();
      expect(screen.getByText(/This content block has content that will be permanently deleted/i)).toBeInTheDocument();

      // onDelete should NOT have been called yet
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should show confirmation dialog for blocks with image prompt', async () => {
      const mockOnDelete = vi.fn();
      const blockWithImagePrompt: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: 'A beautiful sunset over the ocean',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImagePrompt}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete content block/i });
      await userEvent.click(deleteButton);

      // Should show confirmation dialog
      expect(screen.getByText('Delete Content Block?')).toBeInTheDocument();
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should show confirmation dialog for blocks with image URL', async () => {
      const mockOnDelete = vi.fn();
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete content block/i });
      await userEvent.click(deleteButton);

      // Should show confirmation dialog
      expect(screen.getByText('Delete Content Block?')).toBeInTheDocument();
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should call onDelete when confirmation is confirmed', async () => {
      const mockOnDelete = vi.fn();
      const blockWithContent: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: 'Some content',
        imagePrompt: '',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithContent}
          onDelete={mockOnDelete}
        />
      );

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /delete content block/i });
      await userEvent.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await userEvent.click(confirmButton);

      // onDelete should be called
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should not call onDelete when confirmation is cancelled', async () => {
      const mockOnDelete = vi.fn();
      const blockWithContent: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: 'Some content',
        imagePrompt: '',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithContent}
          onDelete={mockOnDelete}
        />
      );

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /delete content block/i });
      await userEvent.click(deleteButton);

      // Cancel deletion
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      // onDelete should NOT be called
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should show confirmation dialog for blocks with keyMessage', async () => {
      const mockOnDelete = vi.fn();
      const blockWithKeyMessage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        keyMessage: 'Important key message',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithKeyMessage}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete content block/i });
      await userEvent.click(deleteButton);

      // Should show confirmation dialog
      expect(screen.getByText('Delete Content Block?')).toBeInTheDocument();
      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });

  describe('Content display', () => {
    it('should display content type in header', () => {
      const mockBlock: GeneratedContentBlock = {
        contentType: 'Email Newsletter',
        adCopy: '',
        imagePrompt: '',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={mockBlock}
        />
      );

      expect(screen.getByText('Email Newsletter')).toBeInTheDocument();
    });

    it('should display scheduled time input for social media posts', () => {
      const mockBlock: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        scheduledTime: '14:30',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={mockBlock}
        />
      );

      // The scheduled time is now displayed as an editable time input
      const timeInput = screen.getByDisplayValue('14:30');
      expect(timeInput).toBeInTheDocument();
      expect(timeInput).toHaveAttribute('type', 'time');
    });

    it('should display tone of voice selector', () => {
      const mockBlock: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        toneOfVoice: 'Playful',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={mockBlock}
        />
      );

      // The tone is displayed in a select dropdown
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('Playful')).toBeInTheDocument();
    });
  });

  describe('Nano Banana - Image editing functionality', () => {
    it('should show edit button when block has an image', () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      expect(editButton).toBeInTheDocument();
    });

    it('should not show edit button when block has no image', () => {
      const blockWithoutImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithoutImage}
        />
      );

      const editButton = screen.queryByRole('button', { name: /edit image with ai/i });
      expect(editButton).not.toBeInTheDocument();
    });

    it('should not show edit button for video content', () => {
      const blockWithVideo: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/video.mp4',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithVideo}
        />
      );

      // Video check is based on URL containing 'video'
      const editButton = screen.queryByRole('button', { name: /edit image with ai/i });
      expect(editButton).not.toBeInTheDocument();
    });

    it('should open edit dialog when edit button is clicked', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // Dialog should be open - now using EditImagePage (AI Image Studio)
      expect(screen.getByText('AI Image Studio')).toBeInTheDocument();
      expect(screen.getByText(/Transform your images with AI/i)).toBeInTheDocument();
    });

    it('should show quick style suggestions in edit dialog', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // Check for quick style buttons - EditImagePage uses different styles
      expect(screen.getByText('+ Cyberpunk style')).toBeInTheDocument();
      expect(screen.getByText('+ Watercolor painting')).toBeInTheDocument();
      expect(screen.getByText('+ Pencil sketch')).toBeInTheDocument();
    });

    it('should add quick style to prompt when clicked', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // Click a quick style - EditImagePage uses different styles
      const cyberpunkButton = screen.getByText('+ Cyberpunk style');
      await userEvent.click(cyberpunkButton);

      // Check the textarea has the style - EditImagePage uses "Prompt" label
      const textarea = screen.getByRole('textbox', { name: /prompt/i });
      expect(textarea).toHaveValue('Cyberpunk style');
    });

    it('should show Generate Image button in edit dialog', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // EditImagePage has a "Generate Image" button
      const generateButton = screen.getByRole('button', { name: /generate image/i });
      expect(generateButton).toBeInTheDocument();
    });

    it('should allow entering prompt in edit dialog', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // EditImagePage uses "Prompt" label
      const textarea = screen.getByRole('textbox', { name: /prompt/i });
      await userEvent.type(textarea, 'Make it blue');

      expect(textarea).toHaveValue('Make it blue');
    });

    it('should call generateEditedImage and update image on successful edit', async () => {
      const mockOnImageUpdate = vi.fn();
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/original.jpg',
      };

      // Mock successful edit
      vi.mocked(generateEditedImage).mockResolvedValueOnce({
        imageUrl: 'data:image/png;base64,edited-image-data',
      });

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
          onImageUpdate={mockOnImageUpdate}
        />
      );

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // Enter prompt - EditImagePage uses "Prompt" label
      const textarea = screen.getByRole('textbox', { name: /prompt/i });
      await userEvent.type(textarea, 'Make it watercolor');

      // Click Generate Image button - EditImagePage uses "Generate Image" not "Apply Edit"
      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await userEvent.click(generateButton);

      // Wait for the async operation
      await waitFor(() => {
        expect(generateEditedImage).toHaveBeenCalledWith(expect.objectContaining({
          prompt: 'Make it watercolor',
          imageUrl: 'https://example.com/original.jpg',
          brandId: 'test-brand',
          mode: 'edit',
          aspectRatio: '1:1',
        }));
      });

      await waitFor(() => {
        expect(mockOnImageUpdate).toHaveBeenCalledWith('data:image/png;base64,edited-image-data', false);
      });
    });

    it('should close dialog when Cancel is clicked', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // Verify dialog is open - EditImagePage uses "AI Image Studio" title
      expect(screen.getByText('AI Image Studio')).toBeInTheDocument();

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      // Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByText('AI Image Studio')).not.toBeInTheDocument();
      });
    });

    it('should call generateEditedImage API when Generate Image is clicked', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      // Mock slow edit operation
      vi.mocked(generateEditedImage).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve({ imageUrl: 'edited.jpg' }), 100))
      );

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // Enter prompt - EditImagePage uses "Prompt" label
      const textarea = screen.getByRole('textbox', { name: /prompt/i });
      await userEvent.type(textarea, 'Edit this');

      // Click Generate Image button - EditImagePage uses "Generate Image" not "Apply Edit"
      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await userEvent.click(generateButton);

      // Verify generateEditedImage was called (loading state is now shown via toast notifications)
      await waitFor(() => {
        expect(generateEditedImage).toHaveBeenCalled();
      });
    });
  });

  describe('Job Queue integration', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should create a job in the Job Queue when editing an image', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      vi.mocked(generateEditedImage).mockResolvedValueOnce({
        imageUrl: 'data:image/png;base64,edited-image-data',
      });

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // Enter prompt
      const textarea = screen.getByRole('textbox', { name: /prompt/i });
      await userEvent.type(textarea, 'Make it blue');

      // Click Generate Image
      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await userEvent.click(generateButton);

      // Verify addJob was called with correct parameters
      await waitFor(() => {
        expect(mockAddJob).toHaveBeenCalledWith(expect.objectContaining({
          type: 'image-editing',
          title: expect.stringContaining('Editing Image'),
          description: 'Make it blue',
          metadata: expect.objectContaining({
            contentType: 'Social Media Post',
            editMode: 'edit',
            prompt: 'Make it blue',
          }),
        }));
      });
    });

    it('should start the job after creating it', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      vi.mocked(generateEditedImage).mockResolvedValueOnce({
        imageUrl: 'data:image/png;base64,edited-image-data',
      });

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // Enter prompt
      const textarea = screen.getByRole('textbox', { name: /prompt/i });
      await userEvent.type(textarea, 'Make it vintage');

      // Click Generate Image
      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await userEvent.click(generateButton);

      // Verify startJob was called with the job ID
      await waitFor(() => {
        expect(mockStartJob).toHaveBeenCalledWith('mock-job-id');
      });
    });

    it('should update job progress during image generation', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      vi.mocked(generateEditedImage).mockResolvedValueOnce({
        imageUrl: 'data:image/png;base64,edited-image-data',
      });

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // Enter prompt
      const textarea = screen.getByRole('textbox', { name: /prompt/i });
      await userEvent.type(textarea, 'Make it pop art');

      // Click Generate Image
      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await userEvent.click(generateButton);

      // Verify setProgress was called with progress values
      await waitFor(() => {
        expect(mockSetProgress).toHaveBeenCalledWith('mock-job-id', 10);
        expect(mockSetProgress).toHaveBeenCalledWith('mock-job-id', 30);
        expect(mockSetProgress).toHaveBeenCalledWith('mock-job-id', 80);
        expect(mockSetProgress).toHaveBeenCalledWith('mock-job-id', 100);
      });
    });

    it('should complete the job when image generation succeeds', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      vi.mocked(generateEditedImage).mockResolvedValueOnce({
        imageUrl: 'data:image/png;base64,edited-image-data',
      });

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // Enter prompt
      const textarea = screen.getByRole('textbox', { name: /prompt/i });
      await userEvent.type(textarea, 'Make it retro');

      // Click Generate Image
      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await userEvent.click(generateButton);

      // Verify completeJob was called
      await waitFor(() => {
        expect(mockCompleteJob).toHaveBeenCalledWith('mock-job-id');
      });
    });

    it('should fail the job when image generation fails', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      // Mock failed edit operation
      vi.mocked(generateEditedImage).mockRejectedValueOnce(new Error('API error: generation failed'));

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // Enter prompt
      const textarea = screen.getByRole('textbox', { name: /prompt/i });
      await userEvent.type(textarea, 'Make it futuristic');

      // Click Generate Image
      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await userEvent.click(generateButton);

      // Verify failJob was called with error message
      await waitFor(() => {
        expect(mockFailJob).toHaveBeenCalledWith('mock-job-id', 'API error: generation failed');
      });
    });

    it('should fail the job when no image URL is returned', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      // Mock edit operation with no imageUrl
      vi.mocked(generateEditedImage).mockResolvedValueOnce({
        imageUrl: undefined as unknown as string,
      });

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // Enter prompt
      const textarea = screen.getByRole('textbox', { name: /prompt/i });
      await userEvent.type(textarea, 'Transform it');

      // Click Generate Image
      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await userEvent.click(generateButton);

      // Verify failJob was called
      await waitFor(() => {
        expect(mockFailJob).toHaveBeenCalledWith('mock-job-id', 'No image URL returned from the editing API');
      });
    });

    it('should close dialog immediately after clicking Generate Image', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      vi.mocked(generateEditedImage).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve({ imageUrl: 'edited.jpg' }), 500))
      );

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // Verify dialog is open
      expect(screen.getByText('AI Image Studio')).toBeInTheDocument();

      // Enter prompt
      const textarea = screen.getByRole('textbox', { name: /prompt/i });
      await userEvent.type(textarea, 'Quick edit');

      // Click Generate Image
      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await userEvent.click(generateButton);

      // Dialog should close immediately (so user can see Job Queue)
      await waitFor(() => {
        expect(screen.queryByText('AI Image Studio')).not.toBeInTheDocument();
      });
    });

    it('should truncate long prompts in job description', async () => {
      const blockWithImage: GeneratedContentBlock = {
        contentType: 'Social Media Post',
        adCopy: '',
        imagePrompt: '',
        imageUrl: 'https://example.com/image.jpg',
      };

      vi.mocked(generateEditedImage).mockResolvedValueOnce({
        imageUrl: 'data:image/png;base64,edited-image-data',
      });

      render(
        <GeneratedContentCard
          {...defaultProps}
          block={blockWithImage}
        />
      );

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit image with ai/i });
      await userEvent.click(editButton);

      // Enter a very long prompt
      const longPrompt = 'This is a very long prompt that should be truncated in the job description for better display';
      const textarea = screen.getByRole('textbox', { name: /prompt/i });
      await userEvent.type(textarea, longPrompt);

      // Click Generate Image
      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await userEvent.click(generateButton);

      // Verify addJob was called with truncated description
      await waitFor(() => {
        expect(mockAddJob).toHaveBeenCalledWith(expect.objectContaining({
          description: 'This is a very long prompt that should be truncate...',
        }));
      });
    });
  });
});
