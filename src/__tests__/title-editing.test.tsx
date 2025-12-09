/**
 * Tests for Title Editing Functionality
 *
 * This test file ensures that title editing is available and consistent across:
 * - Media Library (unified media)
 * - Image Gallery (legacy images)
 * - Video Gallery (legacy videos)
 * - Team Profile (brand assets)
 * - Personal Profile (brand assets)
 *
 * The tests verify:
 * 1. EditableTitle component exists and is properly structured
 * 2. Update actions exist for images, videos, unified media, and brand assets
 * 3. Viewer components include EditableTitle for inline editing
 * 4. The update actions have proper signature
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Title Editing Feature', () => {
  const srcDir = path.join(__dirname, '..');

  describe('EditableTitle Component', () => {
    const editableTitlePath = path.join(srcDir, 'components/ui/editable-title.tsx');

    it('should exist', () => {
      expect(fs.existsSync(editableTitlePath)).toBe(true);
    });

    it('should export EditableTitle component', () => {
      const content = fs.readFileSync(editableTitlePath, 'utf-8');
      expect(content).toContain('export function EditableTitle');
    });

    it('should accept value and onSave props', () => {
      const content = fs.readFileSync(editableTitlePath, 'utf-8');
      expect(content).toContain('value: string');
      expect(content).toContain('onSave:');
    });

    it('should support size variants', () => {
      const content = fs.readFileSync(editableTitlePath, 'utf-8');
      expect(content).toContain("size?: 'sm' | 'md' | 'lg'");
    });

    it('should have edit, save, and cancel functionality', () => {
      const content = fs.readFileSync(editableTitlePath, 'utf-8');
      expect(content).toContain('handleStartEdit');
      expect(content).toContain('handleSave');
      expect(content).toContain('handleCancel');
    });

    it('should show pencil icon for editing', () => {
      const content = fs.readFileSync(editableTitlePath, 'utf-8');
      expect(content).toContain('Pencil');
    });
  });

  describe('Update Actions', () => {
    const actionsPath = path.join(srcDir, 'app/actions.ts');
    const mediaActionsPath = path.join(srcDir, 'lib/actions/media-library-actions.ts');

    it('updateImageAction should exist in actions.ts', () => {
      const content = fs.readFileSync(actionsPath, 'utf-8');
      expect(content).toContain('export async function updateImageAction');
    });

    it('updateVideoAction should exist in actions.ts', () => {
      const content = fs.readFileSync(actionsPath, 'utf-8');
      expect(content).toContain('export async function updateVideoAction');
    });

    it('updateImageAction should accept title in updates', () => {
      const content = fs.readFileSync(actionsPath, 'utf-8');
      // Check that updateImageAction accepts title parameter
      expect(content).toMatch(/updateImageAction[\s\S]*?updates:\s*\{[^}]*title\?:\s*string/);
    });

    it('updateVideoAction should accept title in updates', () => {
      const content = fs.readFileSync(actionsPath, 'utf-8');
      // Check that updateVideoAction accepts title parameter
      expect(content).toMatch(/updateVideoAction[\s\S]*?updates:\s*\{[^}]*title\?:\s*string/);
    });

    it('updateMediaAction should exist in media-library-actions.ts', () => {
      const content = fs.readFileSync(mediaActionsPath, 'utf-8');
      expect(content).toContain('export async function updateMediaAction');
    });

    it('updateMediaAction should accept title in updates', () => {
      const content = fs.readFileSync(mediaActionsPath, 'utf-8');
      // Check that updateMediaAction accepts title parameter
      expect(content).toMatch(/updateMediaAction[\s\S]*?updates:\s*\{[^}]*title\?:\s*string/);
    });

    it('updateBrandAssetAction should exist in actions.ts', () => {
      const content = fs.readFileSync(actionsPath, 'utf-8');
      expect(content).toContain('export async function updateBrandAssetAction');
    });

    it('updateBrandAssetAction should accept name in updates', () => {
      const content = fs.readFileSync(actionsPath, 'utf-8');
      // Check that updateBrandAssetAction accepts name parameter
      expect(content).toMatch(/updateBrandAssetAction[\s\S]*?updates:\s*\{[^}]*name\?:\s*string/);
    });

    it('updateBrandAssetAction should accept assetType parameter', () => {
      const content = fs.readFileSync(actionsPath, 'utf-8');
      // Check that updateBrandAssetAction accepts assetType parameter for image/video/document
      expect(content).toMatch(/updateBrandAssetAction[\s\S]*?assetType:\s*'image'\s*\|\s*'video'\s*\|\s*'document'/);
    });
  });

  describe('ImageViewer Component', () => {
    const imageViewerPath = path.join(srcDir, 'components/image-editing/ImageViewer.tsx');

    it('should exist', () => {
      expect(fs.existsSync(imageViewerPath)).toBe(true);
    });

    it('should import EditableTitle', () => {
      const content = fs.readFileSync(imageViewerPath, 'utf-8');
      expect(content).toContain("import { EditableTitle }");
    });

    it('should import updateImageAction', () => {
      const content = fs.readFileSync(imageViewerPath, 'utf-8');
      expect(content).toContain('updateImageAction');
    });

    it('should use EditableTitle component', () => {
      const content = fs.readFileSync(imageViewerPath, 'utf-8');
      expect(content).toContain('<EditableTitle');
    });

    it('should have onTitleUpdate prop', () => {
      const content = fs.readFileSync(imageViewerPath, 'utf-8');
      expect(content).toContain('onTitleUpdate?:');
    });
  });

  describe('VideoPlayer Component', () => {
    const videoPlayerPath = path.join(srcDir, 'components/VideoPlayer.tsx');

    it('should exist', () => {
      expect(fs.existsSync(videoPlayerPath)).toBe(true);
    });

    it('should import EditableTitle', () => {
      const content = fs.readFileSync(videoPlayerPath, 'utf-8');
      expect(content).toContain("import { EditableTitle }");
    });

    it('should import updateVideoAction', () => {
      const content = fs.readFileSync(videoPlayerPath, 'utf-8');
      expect(content).toContain('updateVideoAction');
    });

    it('should use EditableTitle component', () => {
      const content = fs.readFileSync(videoPlayerPath, 'utf-8');
      expect(content).toContain('<EditableTitle');
    });

    it('should have onTitleUpdate prop', () => {
      const content = fs.readFileSync(videoPlayerPath, 'utf-8');
      expect(content).toContain('onTitleUpdate?:');
    });
  });

  describe('Media Library Page', () => {
    const mediaPagePath = path.join(srcDir, 'app/media/page.tsx');

    it('should exist', () => {
      expect(fs.existsSync(mediaPagePath)).toBe(true);
    });

    it('should import EditableTitle', () => {
      const content = fs.readFileSync(mediaPagePath, 'utf-8');
      expect(content).toContain("import { EditableTitle }");
    });

    it('should import updateMediaAction', () => {
      const content = fs.readFileSync(mediaPagePath, 'utf-8');
      expect(content).toContain('updateMediaAction');
    });

    it('should use EditableTitle in detail panel', () => {
      const content = fs.readFileSync(mediaPagePath, 'utf-8');
      expect(content).toContain('<EditableTitle');
    });
  });

  describe('Images Page', () => {
    const imagesPagePath = path.join(srcDir, 'app/images/page.tsx');

    it('should exist', () => {
      expect(fs.existsSync(imagesPagePath)).toBe(true);
    });

    it('should pass onTitleUpdate to ImageViewer', () => {
      const content = fs.readFileSync(imagesPagePath, 'utf-8');
      expect(content).toContain('onTitleUpdate=');
    });
  });

  describe('Videos Page', () => {
    const videosPagePath = path.join(srcDir, 'app/videos/page.tsx');

    it('should exist', () => {
      expect(fs.existsSync(videosPagePath)).toBe(true);
    });

    it('should pass onTitleUpdate to VideoPlayer', () => {
      const content = fs.readFileSync(videosPagePath, 'utf-8');
      expect(content).toContain('onTitleUpdate=');
    });
  });

  describe('Team Profile Page', () => {
    const teamProfilePagePath = path.join(srcDir, 'app/brand-profile/page.tsx');

    it('should exist', () => {
      expect(fs.existsSync(teamProfilePagePath)).toBe(true);
    });

    it('should import EditableTitle', () => {
      const content = fs.readFileSync(teamProfilePagePath, 'utf-8');
      expect(content).toContain("import { EditableTitle }");
    });

    it('should import updateBrandAssetAction', () => {
      const content = fs.readFileSync(teamProfilePagePath, 'utf-8');
      expect(content).toContain('updateBrandAssetAction');
    });

    it('should use EditableTitle in asset preview modal', () => {
      const content = fs.readFileSync(teamProfilePagePath, 'utf-8');
      expect(content).toContain('<EditableTitle');
    });

    it('should use EditableTitle with size="lg"', () => {
      const content = fs.readFileSync(teamProfilePagePath, 'utf-8');
      expect(content).toContain('size="lg"');
    });

    it('should show toast on success', () => {
      const content = fs.readFileSync(teamProfilePagePath, 'utf-8');
      expect(content).toContain("toast({ title: 'Title updated'");
    });
  });

  describe('Personal Profile Page', () => {
    const personalProfilePagePath = path.join(srcDir, 'app/brand-profile/personal/page.tsx');

    it('should exist', () => {
      expect(fs.existsSync(personalProfilePagePath)).toBe(true);
    });

    it('should import EditableTitle', () => {
      const content = fs.readFileSync(personalProfilePagePath, 'utf-8');
      expect(content).toContain("import { EditableTitle }");
    });

    it('should import updateBrandAssetAction', () => {
      const content = fs.readFileSync(personalProfilePagePath, 'utf-8');
      expect(content).toContain('updateBrandAssetAction');
    });

    it('should use EditableTitle in asset preview modal', () => {
      const content = fs.readFileSync(personalProfilePagePath, 'utf-8');
      expect(content).toContain('<EditableTitle');
    });

    it('should use EditableTitle with size="lg"', () => {
      const content = fs.readFileSync(personalProfilePagePath, 'utf-8');
      expect(content).toContain('size="lg"');
    });

    it('should show toast on success', () => {
      const content = fs.readFileSync(personalProfilePagePath, 'utf-8');
      expect(content).toContain("toast({ title: 'Title updated'");
    });

    it('should disable editing when not viewing own profile', () => {
      const content = fs.readFileSync(personalProfilePagePath, 'utf-8');
      expect(content).toContain('disabled={!isViewingOwnProfile}');
    });
  });

  describe('Consistency Check', () => {
    it('all viewer components should use the same EditableTitle pattern', () => {
      const imageViewerPath = path.join(srcDir, 'components/image-editing/ImageViewer.tsx');
      const videoPlayerPath = path.join(srcDir, 'components/VideoPlayer.tsx');
      const mediaPagePath = path.join(srcDir, 'app/media/page.tsx');
      const teamProfilePagePath = path.join(srcDir, 'app/brand-profile/page.tsx');
      const personalProfilePagePath = path.join(srcDir, 'app/brand-profile/personal/page.tsx');

      const imageViewerContent = fs.readFileSync(imageViewerPath, 'utf-8');
      const videoPlayerContent = fs.readFileSync(videoPlayerPath, 'utf-8');
      const mediaPageContent = fs.readFileSync(mediaPagePath, 'utf-8');
      const teamProfileContent = fs.readFileSync(teamProfilePagePath, 'utf-8');
      const personalProfileContent = fs.readFileSync(personalProfilePagePath, 'utf-8');

      // All should use EditableTitle with size="lg"
      expect(imageViewerContent).toContain('size="lg"');
      expect(videoPlayerContent).toContain('size="lg"');
      expect(mediaPageContent).toContain('size="lg"');
      expect(teamProfileContent).toContain('size="lg"');
      expect(personalProfileContent).toContain('size="lg"');

      // All should show toast on success
      expect(imageViewerContent).toContain("toast({ title: 'Title updated'");
      expect(videoPlayerContent).toContain("toast({ title: 'Title updated'");
      expect(mediaPageContent).toContain("toast({ title: 'Title updated'");
      expect(teamProfileContent).toContain("toast({ title: 'Title updated'");
      expect(personalProfileContent).toContain("toast({ title: 'Title updated'");
    });
  });
});
