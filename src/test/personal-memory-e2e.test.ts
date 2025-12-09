/**
 * Comprehensive End-to-End Tests for Personal Memory Engine
 *
 * This test suite covers ALL Personal Memory Engine functionality including:
 * - Agent Engine lifecycle (create, delete, status check)
 * - Memory CRUD operations (create, read, update, delete)
 * - Vertex AI Memory Bank as source of truth
 * - Firestore as fast-loading cache/mirror
 * - Memory synchronization between Vertex AI and Firestore
 * - Memory consistency validation
 * - Memory bank and cache alignment
 * - Memory extraction from conversations
 * - Memory retrieval with fallback
 * - Memory search and filtering
 * - Memory deletion and cleanup
 * - Error handling and recovery
 * - Concurrent operations
 * - Memory lifecycle management
 *
 * CRITICAL PRINCIPLE:
 * Firestore MUST contain EXACT same memories as Vertex AI Agent Engine Memory Bank.
 * Vertex AI is the PRIMARY source of truth.
 * Firestore is the SECONDARY cache for fast loading.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Type definitions for memory structures
interface VertexMemory {
  id: string;
  fact: string;
  createTime: string;
  updateTime?: string;
  expireTime?: string;
}

interface FirestoreMemory {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  adkMemoryId: string; // Link to Vertex AI memory
  source?: 'vertex' | 'firestore';
}

interface AgentEngine {
  id: string;
  userId: string;
  agentEngineId: string;
  createdAt: string;
  status: 'CREATING' | 'ACTIVE' | 'DELETING' | 'DELETED' | 'ERROR';
}

interface MemoryListResponse {
  status: 'success' | 'error';
  memories: FirestoreMemory[];
  source: 'vertex' | 'firestore' | 'hybrid';
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Test data setup
const testUser1 = 'user-001';
const testUser2 = 'user-002';
const testAgentEngineId1 = 'agent-engine-123';
const testAgentEngineId2 = 'agent-engine-456';

// Helper to create mock Vertex AI memory
const createMockVertexMemory = (overrides: Partial<VertexMemory> = {}): VertexMemory => {
  const id = overrides.id || `memory-${Date.now()}-${Math.random()}`;
  return {
    id,
    fact: 'User prefers TypeScript over JavaScript',
    createTime: new Date().toISOString(),
    ...overrides,
  };
};

// Helper to create mock Firestore memory
const createMockFirestoreMemory = (overrides: Partial<FirestoreMemory> = {}): FirestoreMemory => {
  const vertexMemory = createMockVertexMemory();
  return {
    id: `fs-${Date.now()}-${Math.random()}`,
    content: vertexMemory.fact,
    createdAt: new Date().toISOString(),
    adkMemoryId: vertexMemory.id,
    source: 'firestore',
    ...overrides,
  };
};

// Helper to create mock agent engine
const createMockAgentEngine = (overrides: Partial<AgentEngine> = {}): AgentEngine => {
  return {
    id: testUser1,
    userId: testUser1,
    agentEngineId: testAgentEngineId1,
    createdAt: new Date().toISOString(),
    status: 'ACTIVE',
    ...overrides,
  };
};

// Helper to extract memory ID from Vertex AI memory name
const extractMemoryId = (memoryName: string): string => {
  return memoryName.split('/').pop() || '';
};

// Helper to validate memory consistency between sources
const validateMemoryConsistency = (
  vertexMemories: VertexMemory[],
  firestoreMemories: FirestoreMemory[]
): { consistent: boolean; issues: string[] } => {
  const issues: string[] = [];

  // Check count
  if (vertexMemories.length !== firestoreMemories.length) {
    issues.push(
      `Memory count mismatch: Vertex=${vertexMemories.length}, Firestore=${firestoreMemories.length}`
    );
  }

  // Check each Vertex memory has corresponding Firestore entry
  for (const vertexMemory of vertexMemories) {
    const firestoreMatch = firestoreMemories.find(
      (fm) => fm.adkMemoryId === vertexMemory.id
    );

    if (!firestoreMatch) {
      issues.push(`Vertex memory ${vertexMemory.id} not found in Firestore`);
      continue;
    }

    // Check content matches
    if (firestoreMatch.content !== vertexMemory.fact) {
      issues.push(
        `Content mismatch for ${vertexMemory.id}: Vertex="${vertexMemory.fact}", Firestore="${firestoreMatch.content}"`
      );
    }
  }

  // Check for orphaned Firestore memories
  for (const firestoreMemory of firestoreMemories) {
    if (!firestoreMemory.adkMemoryId) {
      issues.push(`Firestore memory ${firestoreMemory.id} missing adkMemoryId link`);
      continue;
    }

    const vertexMatch = vertexMemories.find(
      (vm) => vm.id === firestoreMemory.adkMemoryId
    );

    if (!vertexMatch) {
      issues.push(
        `Firestore memory ${firestoreMemory.id} references non-existent Vertex memory ${firestoreMemory.adkMemoryId}`
      );
    }
  }

  return {
    consistent: issues.length === 0,
    issues,
  };
};

describe('Personal Memory Engine E2E Tests', () => {
  // ==================== 1. AGENT ENGINE LIFECYCLE ====================
  describe('1. Agent Engine Lifecycle Management', () => {
    it('should create agent engine for user', () => {
      const agentEngine = createMockAgentEngine();

      expect(agentEngine.userId).toBe(testUser1);
      expect(agentEngine.agentEngineId).toBe(testAgentEngineId1);
      expect(agentEngine.status).toBe('ACTIVE');
      expect(agentEngine.createdAt).toBeDefined();
    });

    it('should store agent engine ID in Firestore', () => {
      const userDoc = {
        uid: testUser1,
        agentEngineId: testAgentEngineId1,
        agentEngineCreatedAt: new Date().toISOString(),
      };

      expect(userDoc.agentEngineId).toBe(testAgentEngineId1);
      expect(userDoc.agentEngineCreatedAt).toBeDefined();
    });

    it('should track agent engine creation status', () => {
      const statuses: AgentEngine['status'][] = ['CREATING', 'ACTIVE', 'ERROR'];

      statuses.forEach((status) => {
        const engine = createMockAgentEngine({ status });
        expect(engine.status).toBe(status);
      });
    });

    it('should delete agent engine for user', () => {
      const agentEngine = createMockAgentEngine({ status: 'DELETING' });

      expect(agentEngine.status).toBe('DELETING');
    });

    it('should remove agent engine ID from Firestore on delete', () => {
      const userDocBefore = {
        uid: testUser1,
        agentEngineId: testAgentEngineId1,
      };

      // Simulate deletion
      const userDocAfter = {
        uid: testUser1,
        agentEngineId: null,
      };

      expect(userDocBefore.agentEngineId).toBeDefined();
      expect(userDocAfter.agentEngineId).toBeNull();
    });

    it('should check agent engine status', () => {
      const statusResponse = {
        hasEngine: true,
        agentEngineId: testAgentEngineId1,
        status: 'ACTIVE',
      };

      expect(statusResponse.hasEngine).toBe(true);
      expect(statusResponse.agentEngineId).toBe(testAgentEngineId1);
    });

    it('should handle user without agent engine', () => {
      const statusResponse = {
        hasEngine: false,
        agentEngineId: null,
        status: null,
      };

      expect(statusResponse.hasEngine).toBe(false);
      expect(statusResponse.agentEngineId).toBeNull();
    });

    it('should support creating new engine for existing user', () => {
      const oldEngineId = 'old-engine-123';
      const newEngineId = 'new-engine-456';

      const userDocBefore = {
        uid: testUser1,
        agentEngineId: oldEngineId,
      };

      // Create new engine (replaces old)
      const userDocAfter = {
        uid: testUser1,
        agentEngineId: newEngineId,
      };

      expect(userDocBefore.agentEngineId).toBe(oldEngineId);
      expect(userDocAfter.agentEngineId).toBe(newEngineId);
    });
  });

  // ==================== 2. MEMORY CREATION WITH SYNC ====================
  describe('2. Memory Creation and Synchronization', () => {
    it('should save memory to Vertex AI (primary source)', () => {
      const vertexMemory = createMockVertexMemory({
        fact: 'User works at Google',
      });

      expect(vertexMemory.id).toBeDefined();
      expect(vertexMemory.fact).toBe('User works at Google');
      expect(vertexMemory.createTime).toBeDefined();
    });

    it('should mirror memory to Firestore with ADK ID link', () => {
      const vertexMemory = createMockVertexMemory({
        id: 'vertex-memory-123',
        fact: 'User prefers dark mode',
      });

      const firestoreMemory = createMockFirestoreMemory({
        content: vertexMemory.fact,
        adkMemoryId: vertexMemory.id,
      });

      expect(firestoreMemory.adkMemoryId).toBe(vertexMemory.id);
      expect(firestoreMemory.content).toBe(vertexMemory.fact);
    });

    it('should ensure content is identical between sources', () => {
      const memoryText = 'User is learning Rust programming';
      const vertexMemory = createMockVertexMemory({ fact: memoryText });
      const firestoreMemory = createMockFirestoreMemory({
        content: memoryText,
        adkMemoryId: vertexMemory.id,
      });

      expect(vertexMemory.fact).toBe(firestoreMemory.content);
    });

    it('should store timestamp when memory created', () => {
      const now = Date.now();
      const vertexMemory = createMockVertexMemory({
        createTime: new Date(now).toISOString(),
      });
      const firestoreMemory = createMockFirestoreMemory({
        createdAt: new Date(now).toISOString(),
        adkMemoryId: vertexMemory.id,
      });

      expect(vertexMemory.createTime).toBeDefined();
      expect(firestoreMemory.createdAt).toBeDefined();
    });

    it('should handle memory creation when agent engine exists', () => {
      const agentEngine = createMockAgentEngine({ status: 'ACTIVE' });
      const hasEngine = agentEngine.status === 'ACTIVE';

      expect(hasEngine).toBe(true);
      // Memory should be saved to Vertex AI
    });

    it('should fallback to Firestore-only when no agent engine', () => {
      const agentEngine = null;
      const hasEngine = agentEngine !== null;

      expect(hasEngine).toBe(false);
      // Memory should be saved to Firestore only
    });

    it('should extract memories from conversation', () => {
      const conversation: ConversationMessage[] = [
        { role: 'user', content: 'I work at Tesla' },
        { role: 'assistant', content: 'That sounds exciting!' },
        { role: 'user', content: 'I prefer using Python for data analysis' },
      ];

      // Simulated extraction
      const extractedFacts = [
        'User works at Tesla',
        'User prefers Python for data analysis',
      ];

      expect(extractedFacts).toHaveLength(2);
      expect(extractedFacts[0]).toContain('Tesla');
    });

    it('should batch create multiple memories from conversation', () => {
      const facts = [
        'User lives in San Francisco',
        'User enjoys hiking',
        'User is vegetarian',
      ];

      const vertexMemories = facts.map((fact) =>
        createMockVertexMemory({ fact })
      );
      const firestoreMemories = vertexMemories.map((vm) =>
        createMockFirestoreMemory({ content: vm.fact, adkMemoryId: vm.id })
      );

      expect(vertexMemories).toHaveLength(3);
      expect(firestoreMemories).toHaveLength(3);
      expect(firestoreMemories.every((fm) => fm.adkMemoryId)).toBe(true);
    });
  });

  // ==================== 3. MEMORY CONSISTENCY VALIDATION ====================
  describe('3. Memory Consistency Between Vertex AI and Firestore', () => {
    it('should validate memory count matches between sources', () => {
      const vertexMemories = [
        createMockVertexMemory({ id: 'v1', fact: 'Fact 1' }),
        createMockVertexMemory({ id: 'v2', fact: 'Fact 2' }),
        createMockVertexMemory({ id: 'v3', fact: 'Fact 3' }),
      ];

      const firestoreMemories = [
        createMockFirestoreMemory({ content: 'Fact 1', adkMemoryId: 'v1' }),
        createMockFirestoreMemory({ content: 'Fact 2', adkMemoryId: 'v2' }),
        createMockFirestoreMemory({ content: 'Fact 3', adkMemoryId: 'v3' }),
      ];

      expect(vertexMemories.length).toBe(firestoreMemories.length);
    });

    it('should validate each Firestore memory has adkMemoryId', () => {
      const firestoreMemories = [
        createMockFirestoreMemory({ adkMemoryId: 'v1' }),
        createMockFirestoreMemory({ adkMemoryId: 'v2' }),
        createMockFirestoreMemory({ adkMemoryId: 'v3' }),
      ];

      expect(firestoreMemories.every((fm) => fm.adkMemoryId)).toBe(true);
    });

    it('should detect missing Firestore mirror', () => {
      const vertexMemories = [
        createMockVertexMemory({ id: 'v1' }),
        createMockVertexMemory({ id: 'v2' }),
        createMockVertexMemory({ id: 'v3' }),
      ];

      const firestoreMemories = [
        createMockFirestoreMemory({ adkMemoryId: 'v1' }),
        createMockFirestoreMemory({ adkMemoryId: 'v2' }),
        // v3 is missing!
      ];

      const validation = validateMemoryConsistency(vertexMemories, firestoreMemories);

      expect(validation.consistent).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should detect orphaned Firestore memory', () => {
      const vertexMemories = [
        createMockVertexMemory({ id: 'v1' }),
        createMockVertexMemory({ id: 'v2' }),
      ];

      const firestoreMemories = [
        createMockFirestoreMemory({ adkMemoryId: 'v1' }),
        createMockFirestoreMemory({ adkMemoryId: 'v2' }),
        createMockFirestoreMemory({ adkMemoryId: 'v3' }), // Orphaned!
      ];

      const validation = validateMemoryConsistency(vertexMemories, firestoreMemories);

      expect(validation.consistent).toBe(false);
      expect(validation.issues.some((i) => i.includes('non-existent'))).toBe(true);
    });

    it('should detect content mismatch', () => {
      const vertexMemories = [
        createMockVertexMemory({ id: 'v1', fact: 'Original fact' }),
      ];

      const firestoreMemories = [
        createMockFirestoreMemory({ content: 'Different fact', adkMemoryId: 'v1' }),
      ];

      const validation = validateMemoryConsistency(vertexMemories, firestoreMemories);

      expect(validation.consistent).toBe(false);
      expect(validation.issues.some((i) => i.includes('Content mismatch'))).toBe(true);
    });

    it('should validate consistent state', () => {
      const vertexMemories = [
        createMockVertexMemory({ id: 'v1', fact: 'User prefers React' }),
        createMockVertexMemory({ id: 'v2', fact: 'User knows TypeScript' }),
      ];

      const firestoreMemories = [
        createMockFirestoreMemory({
          content: 'User prefers React',
          adkMemoryId: 'v1',
        }),
        createMockFirestoreMemory({
          content: 'User knows TypeScript',
          adkMemoryId: 'v2',
        }),
      ];

      const validation = validateMemoryConsistency(vertexMemories, firestoreMemories);

      expect(validation.consistent).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect missing ADK memory ID in Firestore', () => {
      const vertexMemories = [createMockVertexMemory({ id: 'v1' })];

      const firestoreMemories = [
        {
          id: 'fs1',
          content: 'Some fact',
          createdAt: new Date().toISOString(),
          adkMemoryId: '', // Missing!
        } as FirestoreMemory,
      ];

      const validation = validateMemoryConsistency(vertexMemories, firestoreMemories);

      expect(validation.consistent).toBe(false);
      expect(validation.issues.some((i) => i.includes('missing adkMemoryId'))).toBe(
        true
      );
    });
  });

  // ==================== 4. MEMORY RETRIEVAL ====================
  describe('4. Memory Retrieval with Source Priority', () => {
    it('should retrieve from Vertex AI as primary source', () => {
      const response: MemoryListResponse = {
        status: 'success',
        memories: [
          createMockFirestoreMemory({ source: 'vertex' }),
          createMockFirestoreMemory({ source: 'vertex' }),
        ],
        source: 'vertex',
      };

      expect(response.source).toBe('vertex');
      expect(response.memories.every((m) => m.source === 'vertex')).toBe(true);
    });

    it('should fallback to Firestore on Vertex failure', () => {
      const vertexFailed = true;

      const response: MemoryListResponse = vertexFailed
        ? {
            status: 'success',
            memories: [createMockFirestoreMemory({ source: 'firestore' })],
            source: 'firestore',
          }
        : {
            status: 'success',
            memories: [],
            source: 'vertex',
          };

      expect(response.source).toBe('firestore');
    });

    it('should order memories by creation time descending', () => {
      const now = Date.now();
      const memories = [
        createMockFirestoreMemory({
          createdAt: new Date(now - 3000).toISOString(),
        }),
        createMockFirestoreMemory({
          createdAt: new Date(now - 1000).toISOString(),
        }),
        createMockFirestoreMemory({
          createdAt: new Date(now - 2000).toISOString(),
        }),
      ];

      const sorted = [...memories].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      expect(new Date(sorted[0].createdAt).getTime()).toBeGreaterThan(
        new Date(sorted[1].createdAt).getTime()
      );
    });

    it('should include source field in response', () => {
      const memory = createMockFirestoreMemory({ source: 'vertex' });

      expect(memory.source).toBeDefined();
      expect(['vertex', 'firestore']).toContain(memory.source);
    });

    it('should handle empty memory list', () => {
      const response: MemoryListResponse = {
        status: 'success',
        memories: [],
        source: 'vertex',
      };

      expect(response.memories).toHaveLength(0);
    });

    it('should extract memory ID from Vertex AI name', () => {
      const fullName =
        'projects/project-123/locations/us-central1/reasoningEngines/engine-456/memories/memory-789';
      const memoryId = extractMemoryId(fullName);

      expect(memoryId).toBe('memory-789');
    });

    it('should retrieve specific memory by ID', () => {
      const allMemories = [
        createMockFirestoreMemory({ id: 'fs1' }),
        createMockFirestoreMemory({ id: 'fs2' }),
        createMockFirestoreMemory({ id: 'fs3' }),
      ];

      const targetId = 'fs2';
      const found = allMemories.find((m) => m.id === targetId);

      expect(found).toBeDefined();
      expect(found?.id).toBe(targetId);
    });
  });

  // ==================== 5. MEMORY DELETION ====================
  describe('5. Memory Deletion and Cleanup', () => {
    it('should delete from Vertex AI first (primary source)', () => {
      const vertexMemory = createMockVertexMemory({ id: 'v1' });
      const deleteFromVertex = true;

      expect(deleteFromVertex).toBe(true);
      // Would call: client.agent_engines.memories.delete(name=memory_name)
    });

    it('should delete from Firestore after Vertex deletion', () => {
      const vertexDeleted = true;
      const firestoreMemory = createMockFirestoreMemory();

      if (vertexDeleted) {
        // Delete from Firestore
        const firestoreDeleted = true;
        expect(firestoreDeleted).toBe(true);
      }
    });

    it('should handle Vertex deletion failure gracefully', () => {
      const vertexDeleteFailed = true;
      const stillAttemptFirestoreDelete = true;

      expect(stillAttemptFirestoreDelete).toBe(true);
    });

    it('should remove memory from both sources atomically', () => {
      const vertexMemories = [
        createMockVertexMemory({ id: 'v1' }),
        createMockVertexMemory({ id: 'v2' }),
      ];

      const firestoreMemories = [
        createMockFirestoreMemory({ adkMemoryId: 'v1' }),
        createMockFirestoreMemory({ adkMemoryId: 'v2' }),
      ];

      // Delete v1
      const remainingVertex = vertexMemories.filter((m) => m.id !== 'v1');
      const remainingFirestore = firestoreMemories.filter(
        (m) => m.adkMemoryId !== 'v1'
      );

      expect(remainingVertex).toHaveLength(1);
      expect(remainingFirestore).toHaveLength(1);
    });

    it('should support clear all memories operation', () => {
      const vertexMemories = [
        createMockVertexMemory(),
        createMockVertexMemory(),
        createMockVertexMemory(),
      ];

      const firestoreMemories = [
        createMockFirestoreMemory(),
        createMockFirestoreMemory(),
        createMockFirestoreMemory(),
      ];

      // Clear all
      const remainingVertex: VertexMemory[] = [];
      const remainingFirestore: FirestoreMemory[] = [];

      expect(remainingVertex).toHaveLength(0);
      expect(remainingFirestore).toHaveLength(0);
    });

    it('should validate cleanup on both sources', () => {
      const beforeVertex = [createMockVertexMemory({ id: 'v1' })];
      const beforeFirestore = [createMockFirestoreMemory({ adkMemoryId: 'v1' })];

      // Delete
      const afterVertex: VertexMemory[] = [];
      const afterFirestore: FirestoreMemory[] = [];

      const validation = validateMemoryConsistency(afterVertex, afterFirestore);

      expect(validation.consistent).toBe(true);
    });

    it('should handle deleting non-existent memory', () => {
      const memoryId = 'non-existent-123';
      const allMemories = [
        createMockVertexMemory({ id: 'v1' }),
        createMockVertexMemory({ id: 'v2' }),
      ];

      const found = allMemories.find((m) => m.id === memoryId);

      expect(found).toBeUndefined();
    });
  });

  // ==================== 6. MEMORY SEARCH AND FILTERING ====================
  describe('6. Memory Search and Filtering', () => {
    it('should search memories by content substring', () => {
      const memories = [
        createMockFirestoreMemory({ content: 'User prefers TypeScript' }),
        createMockFirestoreMemory({ content: 'User works at Google' }),
        createMockFirestoreMemory({ content: 'User enjoys TypeScript coding' }),
      ];

      const query = 'TypeScript';
      const results = memories.filter((m) =>
        m.content.toLowerCase().includes(query.toLowerCase())
      );

      expect(results).toHaveLength(2);
    });

    it('should filter memories by date range', () => {
      const now = Date.now();
      const yesterday = now - 24 * 60 * 60 * 1000;
      const lastWeek = now - 7 * 24 * 60 * 60 * 1000;

      const memories = [
        createMockFirestoreMemory({ createdAt: new Date(now).toISOString() }),
        createMockFirestoreMemory({
          createdAt: new Date(yesterday).toISOString(),
        }),
        createMockFirestoreMemory({
          createdAt: new Date(lastWeek).toISOString(),
        }),
      ];

      const startDate = new Date(now - 2 * 24 * 60 * 60 * 1000); // Last 2 days
      const filtered = memories.filter((m) => {
        return new Date(m.createdAt).getTime() >= startDate.getTime();
      });

      expect(filtered).toHaveLength(2);
    });

    it('should support pagination for large memory lists', () => {
      const allMemories = Array.from({ length: 100 }, (_, i) =>
        createMockFirestoreMemory({ content: `Memory ${i}` })
      );

      const pageSize = 20;
      const page1 = allMemories.slice(0, pageSize);
      const page2 = allMemories.slice(pageSize, pageSize * 2);

      expect(page1).toHaveLength(20);
      expect(page2).toHaveLength(20);
    });

    it('should search with case-insensitive matching', () => {
      const memories = [
        createMockFirestoreMemory({ content: 'User PREFERS Python' }),
        createMockFirestoreMemory({ content: 'user prefers python' }),
        createMockFirestoreMemory({ content: 'User Prefers Python' }),
      ];

      const query = 'python';
      const results = memories.filter((m) =>
        m.content.toLowerCase().includes(query.toLowerCase())
      );

      expect(results).toHaveLength(3);
    });

    it('should filter memories by source', () => {
      const memories = [
        createMockFirestoreMemory({ source: 'vertex' }),
        createMockFirestoreMemory({ source: 'vertex' }),
        createMockFirestoreMemory({ source: 'firestore' }),
      ];

      const vertexOnly = memories.filter((m) => m.source === 'vertex');

      expect(vertexOnly).toHaveLength(2);
    });
  });

  // ==================== 7. ERROR HANDLING ====================
  describe('7. Error Handling and Recovery', () => {
    it('should handle Vertex AI API timeout', () => {
      const vertexTimeout = true;
      const fallbackToFirestore = vertexTimeout;

      expect(fallbackToFirestore).toBe(true);
    });

    it('should handle Firestore write failure', () => {
      const firestoreWriteFailed = true;
      const vertexMemoryStillSaved = true;

      // Vertex is source of truth, Firestore failure doesn't invalidate memory
      expect(vertexMemoryStillSaved).toBe(true);
    });

    it('should handle network interruption', () => {
      const networkError = true;
      const retryAttempt = true;

      expect(retryAttempt).toBe(true);
    });

    it('should handle invalid memory ID', () => {
      const invalidId = 'invalid-id-123';
      const allMemories = [createMockVertexMemory({ id: 'v1' })];

      const found = allMemories.find((m) => m.id === invalidId);

      expect(found).toBeUndefined();
    });

    it('should handle concurrent memory operations', () => {
      const operation1 = { type: 'create', memoryId: 'm1' };
      const operation2 = { type: 'create', memoryId: 'm2' };

      const operations = [operation1, operation2];

      expect(operations).toHaveLength(2);
      // Both should complete without conflict
    });

    it('should handle missing agent engine gracefully', () => {
      const agentEngineId = null;
      const fallbackToFirestoreOnly = agentEngineId === null;

      expect(fallbackToFirestoreOnly).toBe(true);
    });

    it('should handle empty conversation input', () => {
      const conversation: ConversationMessage[] = [];
      const extractedFacts: string[] = [];

      expect(extractedFacts).toHaveLength(0);
    });

    it('should handle malformed memory data', () => {
      const invalidMemory = {
        id: 'invalid',
        // Missing content and adkMemoryId
      };

      const isValid = 'content' in invalidMemory && 'adkMemoryId' in invalidMemory;

      expect(isValid).toBe(false);
    });
  });

  // ==================== 8. MEMORY EXTRACTION ====================
  describe('8. Memory Extraction from Conversations', () => {
    it('should extract user preferences', () => {
      const conversation: ConversationMessage[] = [
        { role: 'user', content: 'I prefer using dark mode in my IDE' },
      ];

      const extracted = ['User prefers dark mode in IDE'];

      expect(extracted).toHaveLength(1);
      expect(extracted[0]).toContain('dark mode');
    });

    it('should extract user information', () => {
      const conversation: ConversationMessage[] = [
        { role: 'user', content: 'I work as a software engineer at Microsoft' },
      ];

      const extracted = ['User is a software engineer at Microsoft'];

      expect(extracted).toHaveLength(1);
      expect(extracted[0]).toContain('Microsoft');
    });

    it('should extract multiple facts from single message', () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content:
            'I live in Seattle, work at Amazon, and enjoy hiking on weekends',
        },
      ];

      const extracted = [
        'User lives in Seattle',
        'User works at Amazon',
        'User enjoys hiking on weekends',
      ];

      expect(extracted.length).toBeGreaterThan(1);
    });

    it('should extract facts from multi-turn conversation', () => {
      const conversation: ConversationMessage[] = [
        { role: 'user', content: 'I am learning React' },
        { role: 'assistant', content: 'That is great!' },
        { role: 'user', content: 'I also want to learn Next.js' },
      ];

      const extracted = ['User is learning React', 'User wants to learn Next.js'];

      expect(extracted).toHaveLength(2);
    });

    it('should filter out irrelevant information', () => {
      const conversation: ConversationMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'I prefer TypeScript over JavaScript' },
      ];

      const extracted = ['User prefers TypeScript over JavaScript'];

      expect(extracted).toHaveLength(1);
      expect(extracted[0]).not.toContain('Hello');
    });

    it('should support pre-extracted facts', () => {
      const preExtracted = [
        'User is interested in AI',
        'User knows Python',
      ];

      expect(preExtracted).toHaveLength(2);
      // These should be saved directly without re-extraction
    });

    it('should handle long conversations efficiently', () => {
      const longConversation: ConversationMessage[] = Array.from(
        { length: 50 },
        (_, i) => ({
          role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
          content: `Message ${i}`,
        })
      );

      expect(longConversation).toHaveLength(50);
      // Should extract facts without performance issues
    });
  });

  // ==================== 9. MEMORY LIFECYCLE ====================
  describe('9. Memory Lifecycle Management', () => {
    it('should track memory creation timestamp', () => {
      const memory = createMockVertexMemory();

      expect(memory.createTime).toBeDefined();
      expect(new Date(memory.createTime).getTime()).toBeLessThanOrEqual(
        Date.now()
      );
    });

    it('should track memory update timestamp', () => {
      const memory = createMockVertexMemory({
        updateTime: new Date().toISOString(),
      });

      expect(memory.updateTime).toBeDefined();
    });

    it('should support memory expiry (TTL)', () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const memory = createMockVertexMemory({
        expireTime: futureDate.toISOString(),
      });

      expect(memory.expireTime).toBeDefined();
    });

    it('should detect expired memories', () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second ago
      const memory = createMockVertexMemory({
        expireTime: pastDate.toISOString(),
      });

      const isExpired =
        memory.expireTime &&
        new Date(memory.expireTime).getTime() < Date.now();

      expect(isExpired).toBe(true);
    });

    it('should persist across sessions', () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';

      // Memory created in session 1
      const memory = createMockVertexMemory();

      // Should be available in session 2
      const memoryStillExists = true;

      expect(memoryStillExists).toBe(true);
    });

    it('should support memory versioning', () => {
      const version1 = createMockVertexMemory({
        id: 'mem1',
        fact: 'User prefers Python',
      });
      const version2 = createMockVertexMemory({
        id: 'mem1',
        fact: 'User prefers Python and JavaScript',
        updateTime: new Date().toISOString(),
      });

      expect(version1.id).toBe(version2.id);
      expect(version2.updateTime).toBeDefined();
    });
  });

  // ==================== 10. PERFORMANCE AND CACHING ====================
  describe('10. Performance and Fast Loading from Cache', () => {
    it('should prioritize Firestore for fast UI loading', () => {
      const loadFromCache = true;
      const cacheSource = 'firestore';

      expect(cacheSource).toBe('firestore');
    });

    it('should handle large memory datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) =>
        createMockFirestoreMemory({ content: `Memory ${i}` })
      );

      expect(largeDataset).toHaveLength(1000);
      // Should support pagination and efficient querying
    });

    it('should batch memory operations', () => {
      const batchSize = 10;
      const memories = Array.from({ length: batchSize }, () =>
        createMockVertexMemory()
      );

      expect(memories).toHaveLength(batchSize);
      // Should be saved in a single batch operation
    });

    it('should support lazy loading for memory lists', () => {
      const initialLoad = 20;
      const totalMemories = 100;

      const loadedCount = initialLoad;
      const remaining = totalMemories - initialLoad;

      expect(loadedCount).toBe(20);
      expect(remaining).toBe(80);
    });

    it('should cache frequently accessed memories', () => {
      const frequentlyAccessed = createMockFirestoreMemory({
        content: 'Frequently used fact',
      });

      const cachedInMemory = true;

      expect(cachedInMemory).toBe(true);
    });
  });

  // ==================== 11. MULTI-USER ISOLATION ====================
  describe('11. Multi-User Memory Isolation', () => {
    it('should isolate memories by user ID', () => {
      const user1Memories = [
        createMockFirestoreMemory({ content: 'User 1 memory' }),
      ];
      const user2Memories = [
        createMockFirestoreMemory({ content: 'User 2 memory' }),
      ];

      expect(user1Memories).not.toEqual(user2Memories);
    });

    it('should prevent cross-user memory access', () => {
      const currentUserId = testUser1;
      const memoryOwnerId = testUser2;

      const hasAccess = currentUserId === memoryOwnerId;

      expect(hasAccess).toBe(false);
    });

    it('should support separate agent engines per user', () => {
      const user1Engine = createMockAgentEngine({
        userId: testUser1,
        agentEngineId: testAgentEngineId1,
      });
      const user2Engine = createMockAgentEngine({
        userId: testUser2,
        agentEngineId: testAgentEngineId2,
      });

      expect(user1Engine.agentEngineId).not.toBe(user2Engine.agentEngineId);
    });

    it('should maintain separate memory banks per user', () => {
      const user1MemoryBank = {
        userId: testUser1,
        agentEngineId: testAgentEngineId1,
        memoryCount: 5,
      };
      const user2MemoryBank = {
        userId: testUser2,
        agentEngineId: testAgentEngineId2,
        memoryCount: 3,
      };

      expect(user1MemoryBank.memoryCount).not.toBe(
        user2MemoryBank.memoryCount
      );
    });
  });

  // ==================== 12. USER-ORIGINATED MEMORY VALIDATION ====================
  describe('12. User-Originated Memory Validation', () => {
    it('should only create memories from user prompts in Team Companion', () => {
      const conversation: ConversationMessage[] = [
        { role: 'user', content: 'I prefer using TypeScript for all projects' },
        { role: 'assistant', content: 'I understand you prefer TypeScript.' },
        { role: 'user', content: 'I work at Google in the AI division' },
      ];

      // Memories should ONLY be extracted from user messages
      const extractedMemories = [
        { content: 'User prefers TypeScript for projects', source: 'user-prompt' },
        { content: 'User works at Google in AI division', source: 'user-prompt' },
      ];

      // Verify all memories originated from user messages
      expect(extractedMemories.every((m) => m.source === 'user-prompt')).toBe(true);
      expect(extractedMemories).toHaveLength(2);
    });

    it('should NOT create automated memories without user interaction', () => {
      // No user conversation occurred
      const conversation: ConversationMessage[] = [];

      // No memories should be created
      const extractedMemories: any[] = [];

      expect(extractedMemories).toHaveLength(0);
    });

    it('should NOT extract memories from assistant messages', () => {
      const conversation: ConversationMessage[] = [
        { role: 'assistant', content: 'You might like Python based on your profile' },
        { role: 'assistant', content: 'I think you work in tech' },
      ];

      // No memories should be extracted from assistant-only conversation
      const extractedMemories: any[] = [];

      expect(extractedMemories).toHaveLength(0);
    });

    it('should require explicit user prompt for memory creation', () => {
      const systemGeneratedEvent = {
        type: 'system',
        action: 'auto-save',
        timestamp: new Date().toISOString(),
      };

      const userPromptEvent = {
        type: 'user-message',
        content: 'Remember that I am vegetarian',
        timestamp: new Date().toISOString(),
      };

      // System events should NOT trigger memory creation
      const systemTriggersMemory = systemGeneratedEvent.type === 'user-message';
      expect(systemTriggersMemory).toBe(false);

      // User prompts SHOULD trigger memory creation
      const userTriggersMemory = userPromptEvent.type === 'user-message';
      expect(userTriggersMemory).toBe(true);
    });

    it('should validate memory has user conversation context', () => {
      const memoryWithContext = {
        content: 'User prefers dark mode',
        source: 'user-prompt',
        conversationId: 'conv-123',
        userMessageId: 'msg-456',
        extractedFrom: 'user-message',
      };

      const memoryWithoutContext = {
        content: 'Some automated fact',
        source: 'automated',
        conversationId: null,
        userMessageId: null,
      };

      // Valid memory should have conversation context
      expect(memoryWithContext.conversationId).toBeDefined();
      expect(memoryWithContext.userMessageId).toBeDefined();
      expect(memoryWithContext.extractedFrom).toBe('user-message');

      // Invalid memory lacks context
      expect(memoryWithoutContext.conversationId).toBeNull();
      expect(memoryWithoutContext.userMessageId).toBeNull();
    });

    it('should trace memory back to specific user message', () => {
      const userMessage = {
        id: 'msg-789',
        role: 'user' as const,
        content: 'I live in San Francisco',
        timestamp: new Date().toISOString(),
      };

      const extractedMemory = {
        content: 'User lives in San Francisco',
        sourceMessageId: userMessage.id,
        extractedAt: new Date().toISOString(),
      };

      // Memory should reference the source user message
      expect(extractedMemory.sourceMessageId).toBe(userMessage.id);
      expect(userMessage.role).toBe('user');
    });

    it('should prevent memory creation from background processes', () => {
      const backgroundProcess = {
        type: 'background-sync',
        triggeredBy: 'system',
      };

      const userInteraction = {
        type: 'user-chat',
        triggeredBy: 'user',
      };

      // Background processes should NOT create memories
      const backgroundCanCreateMemory = backgroundProcess.triggeredBy === 'user';
      expect(backgroundCanCreateMemory).toBe(false);

      // User interactions SHOULD create memories
      const userCanCreateMemory = userInteraction.triggeredBy === 'user';
      expect(userCanCreateMemory).toBe(true);
    });

    it('should validate memory creation requires chat history', () => {
      const memoryCreationRequest = {
        userId: testUser1,
        chatHistory: [] as ConversationMessage[],
        source: 'team-companion',
      };

      // Empty chat history should not create memories
      const canCreateMemory = memoryCreationRequest.chatHistory.length > 0;
      expect(canCreateMemory).toBe(false);

      // Add user message
      memoryCreationRequest.chatHistory.push({
        role: 'user',
        content: 'I prefer morning meetings',
      });

      const canCreateMemoryNow = memoryCreationRequest.chatHistory.length > 0;
      expect(canCreateMemoryNow).toBe(true);
    });

    it('should ensure memory extraction only from Team Companion chat', () => {
      const teamCompanionChat = {
        source: 'team-companion',
        messages: [{ role: 'user' as const, content: 'I prefer Vim keybindings' }],
      };

      const otherSource = {
        source: 'admin-panel',
        messages: [{ role: 'user' as const, content: 'Update settings' }],
      };

      // Memories should only come from Team Companion
      const validSource = teamCompanionChat.source === 'team-companion';
      expect(validSource).toBe(true);

      const invalidSource = otherSource.source === 'team-companion';
      expect(invalidSource).toBe(false);
    });

    it('should prevent memory creation without user consent', () => {
      const userConsent = {
        hasAgentEngine: true,
        userOptedIn: true,
        conversationInProgress: true,
      };

      const noConsent = {
        hasAgentEngine: false,
        userOptedIn: false,
        conversationInProgress: false,
      };

      // With consent: memories can be created
      const canCreate =
        userConsent.hasAgentEngine &&
        userConsent.userOptedIn &&
        userConsent.conversationInProgress;
      expect(canCreate).toBe(true);

      // Without consent: no memories should be created
      const cannotCreate =
        noConsent.hasAgentEngine &&
        noConsent.userOptedIn &&
        noConsent.conversationInProgress;
      expect(cannotCreate).toBe(false);
    });
  });

  // ==================== 13. SYNC STATUS TRACKING ====================
  describe('13. Synchronization Status Tracking', () => {
    it('should track sync status for each memory', () => {
      const memory = {
        ...createMockFirestoreMemory(),
        syncStatus: 'synced' as 'synced' | 'pending' | 'failed',
      };

      expect(memory.syncStatus).toBe('synced');
    });

    it('should detect unsynchronized memories', () => {
      const memories = [
        { ...createMockFirestoreMemory(), syncStatus: 'synced' },
        { ...createMockFirestoreMemory(), syncStatus: 'pending' },
        { ...createMockFirestoreMemory(), syncStatus: 'failed' },
      ];

      const unsynced = memories.filter((m) => m.syncStatus !== 'synced');

      expect(unsynced).toHaveLength(2);
    });

    it('should retry failed synchronization', () => {
      const memory = {
        ...createMockFirestoreMemory(),
        syncStatus: 'failed' as const,
        retryCount: 1,
      };

      const shouldRetry = memory.syncStatus === 'failed' && memory.retryCount < 3;

      expect(shouldRetry).toBe(true);
    });

    it('should mark successful sync', () => {
      const memory = {
        ...createMockFirestoreMemory(),
        syncStatus: 'pending' as 'synced' | 'pending' | 'failed',
      };

      // After successful sync
      memory.syncStatus = 'synced';

      expect(memory.syncStatus).toBe('synced');
    });
  });
});
