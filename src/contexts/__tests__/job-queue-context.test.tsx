import { describe, it, expect } from 'vitest';
import { getJobTypeInfo } from '../job-queue-context';

describe('job-queue-context', () => {
  describe('getJobTypeInfo', () => {
    it('should return correct info for brand-text-generation', () => {
      const info = getJobTypeInfo('brand-text-generation');
      expect(info).toEqual({
        label: 'Brand Text',
        emoji: '✍️',
        color: 'text-violet-500',
      });
    });

    it('should return correct info for campaign-generation', () => {
      const info = getJobTypeInfo('campaign-generation');
      expect(info).toEqual({
        label: 'Campaign',
        emoji: '📅',
        color: 'text-blue-500',
      });
    });

    it('should return correct info for campaign-content', () => {
      const info = getJobTypeInfo('campaign-content');
      expect(info).toEqual({
        label: 'Content',
        emoji: '✨',
        color: 'text-purple-500',
      });
    });

    it('should return correct info for image-generation', () => {
      const info = getJobTypeInfo('image-generation');
      expect(info).toEqual({
        label: 'Image',
        emoji: '🖼️',
        color: 'text-green-500',
      });
    });

    it('should return correct info for image-editing', () => {
      const info = getJobTypeInfo('image-editing');
      expect(info).toEqual({
        label: 'Image Edit',
        emoji: '✏️',
        color: 'text-orange-500',
      });
    });

    it('should return correct info for video-generation', () => {
      const info = getJobTypeInfo('video-generation');
      expect(info).toEqual({
        label: 'Video',
        emoji: '🎬',
        color: 'text-pink-500',
      });
    });

    it('should return correct info for brand-soul-synthesis', () => {
      const info = getJobTypeInfo('brand-soul-synthesis');
      expect(info).toEqual({
        label: 'Intelligence',
        emoji: '🧠',
        color: 'text-indigo-500',
      });
    });

    it('should return correct info for bulk-content', () => {
      const info = getJobTypeInfo('bulk-content');
      expect(info).toEqual({
        label: 'Bulk Content',
        emoji: '📦',
        color: 'text-teal-500',
      });
    });

    it('should return correct info for artifact-processing', () => {
      const info = getJobTypeInfo('artifact-processing');
      expect(info).toEqual({
        label: 'Artifact',
        emoji: '📄',
        color: 'text-purple-500',
      });
    });

    it('should return correct info for source-ingest-text', () => {
      const info = getJobTypeInfo('source-ingest-text');
      expect(info).toEqual({
        label: 'Text Ingest',
        emoji: '📝',
        color: 'text-blue-500',
      });
    });

    it('should return correct info for source-ingest-website', () => {
      const info = getJobTypeInfo('source-ingest-website');
      expect(info).toEqual({
        label: 'Website Crawl',
        emoji: '🌐',
        color: 'text-cyan-500',
      });
    });

    it('should return correct info for source-ingest-document', () => {
      const info = getJobTypeInfo('source-ingest-document');
      expect(info).toEqual({
        label: 'Document',
        emoji: '📑',
        color: 'text-amber-500',
      });
    });

    it('should return correct info for source-ingest-image', () => {
      const info = getJobTypeInfo('source-ingest-image');
      expect(info).toEqual({
        label: 'Image Upload',
        emoji: '🖼️',
        color: 'text-green-500',
      });
    });

    it('should return correct info for source-ingest-video', () => {
      const info = getJobTypeInfo('source-ingest-video');
      expect(info).toEqual({
        label: 'Video Upload',
        emoji: '🎥',
        color: 'text-pink-500',
      });
    });

    it('should return correct info for source-ingest-youtube', () => {
      const info = getJobTypeInfo('source-ingest-youtube');
      expect(info).toEqual({
        label: 'YouTube',
        emoji: '▶️',
        color: 'text-red-500',
      });
    });

    it('should return correct info for event-deletion', () => {
      const info = getJobTypeInfo('event-deletion');
      expect(info).toEqual({
        label: 'Event Delete',
        emoji: '🗑️',
        color: 'text-red-500',
      });
    });

    it('should return default info for unknown type', () => {
      // @ts-expect-error - Testing unknown type
      const info = getJobTypeInfo('unknown-type');
      expect(info).toEqual({
        label: 'Job',
        emoji: '⚡',
        color: 'text-gray-500',
      });
    });
  });
});
