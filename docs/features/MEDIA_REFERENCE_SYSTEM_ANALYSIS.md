# Media Reference System - Comprehensive Analysis & Redesign

## 🔍 Current Implementation Analysis

### Architecture Overview
```
Frontend (Next.js) → API Route → Python Agent → AI Tools
     ↓                  ↓              ↓
  Attachments    Image Context    Tool Selection
     ↓                  ↓              ↓
  Media Files    resolveImage    nano_banana/generate_image
```

### Current Flow
1. **Frontend**: User uploads/injects media → stored in `attachments`
2. **API Route**: Extract `imageContext` from chat history
3. **Priority Logic**: New media > Referenced media > No media
4. **Python Agent**: Receives media + image_context
5. **Agent Decision**: Selects appropriate tool (generate_image, nano_banana, generate_video)

---

## ⚠️ IDENTIFIED WEAKNESSES & EDGE CASES

### 🔴 **Critical Issues**

#### 1. **Multi-Image Ambiguity**
**Problem**: When user uploads 3 images and says "edit this one", system doesn't know which one.

**Current Behavior**:
- All 3 images sent to agent
- Agent instruction text: "Attached Media: image1.jpg, image2.jpg, image3.jpg"
- User says: "make it red"
- **AMBIGUOUS**: Which image to edit?

**Example Failure**:
```
User uploads: [car.jpg, house.jpg, tree.jpg]
User: "make the house blue"
Agent receives: 3 images + "make the house blue"
Result: ❌ Might apply to wrong image or fail
```

#### 2. **Video + Image Confusion**
**Problem**: User uploads video + image, says "edit this", unclear which media.

**Example**:
```
User uploads: [sunset_video.mp4, sunset_image.jpg]
User: "add more colors"
Agent: ❌ Unclear if video editing or image editing
```

#### 3. **Historical Reference with New Upload**
**Problem**: User uploads new image but references old image in text.

**Current Priority**: NEW media always takes precedence
**Issue**: Text like "combine with the last image" is ignored

**Example**:
```
History: [old_logo.png] (image 1)
User uploads: [new_background.png]
User: "combine with image 1"
Current: ❌ Only new_background.png sent, ignores old_logo.png
Correct: ✅ Should send BOTH images
```

#### 4. **Index Mismatch After Truncation**
**Problem**: Message history is truncated for token limits, but image indices remain from full history.

**Example**:
```
Full History: 50 messages, 10 images (indices 1-10)
Truncated: Last 10 messages, only images 7-10 remain
User: "edit image 3"
Current: ❌ Image 3 was removed by truncation
Result: Reference fails silently
```

#### 5. **No Multi-Image Tool Support**
**Problem**: `nano_banana` and editing tools expect 1 primary image + optional references.

**Example**:
```
User uploads: [img1.jpg, img2.jpg, img3.jpg]
User: "combine these"
Current: ❌ Sends all 3 as "attached media" but tool doesn't know which is primary
Agent: Confused about which to use as base image
```

#### 6. **Media Stripping Breaks References**
**Problem**: Token optimization strips media from older messages, but references still exist.

**Code**:
```typescript
if (!isRecent && message.media && message.media.length > 0) {
  const strippedMessage = { ...message, media: undefined };
  // ❌ Media stripped but user can still say "the blue car from earlier"
}
```

#### 7. **No Explicit "This" Tracking**
**Problem**: When user says "edit this" after multiple uploads, unclear which "this" refers to.

**NLP Ambiguity**:
- "this image" - which one?
- "that one" - which one?
- "the last one" - last uploaded? last mentioned? last shown?

#### 8. **Cross-Turn Reference Failure**
**Problem**: User uploads in turn 1, discusses in turn 2-5, references in turn 6.

**Example**:
```
Turn 1: Upload [logo.png]
Turn 2: "what colors work with this?"
Turn 3: "should I use blue or green?"
Turn 4: "let's go with blue"
Turn 5: "actually, green is better"
Turn 6: "ok edit the logo to be green"
Current: ❌ "the logo" reference might fail if history truncated
```

#### 9. **Filename Collisions**
**Problem**: Two files named "image.png" uploaded at different times.

**Example**:
```
Turn 1: Upload image.png (car)
Turn 10: Upload image.png (house)
User: "edit image.png"
Current: ❌ Which image.png?
```

#### 10. **No Semantic Understanding**
**Problem**: Agent doesn't understand content of images for reference resolution.

**Example**:
```
User uploads: [car.jpg, house.jpg, tree.jpg]
User: "make the car red"
Current: ❌ Agent doesn't know which image contains a car
Needs: Semantic analysis or explicit selection
```

---

## 🎯 **ROBUST SOLUTION DESIGN**

### Core Principles
1. **Explicit > Implicit**: Prefer explicit user selection over inference
2. **Semantic-Aware**: Understand image content for better matching
3. **Context-Preserving**: Track media across message history robustly
4. **Multi-Image Support**: Handle multiple simultaneous images intelligently
5. **Error-Resilient**: Graceful fallbacks when ambiguous

### Enhanced Media Context Structure

```typescript
interface RobustMediaContext {
  // Current turn media (uploaded/injected THIS turn)
  currentTurnMedia: EnhancedMedia[];
  
  // All available media from conversation (with persistence IDs)
  availableMedia: EnhancedMedia[];
  
  // Resolved media for AI (after disambiguation)
  resolvedMedia: EnhancedMedia[];
  
  // Reference resolution metadata
  resolution: {
    method: 'explicit_upload' | 'numeric_reference' | 'semantic_match' | 'recency' | 'ambiguous';
    confidence: number; // 0-1
    matchedIndices: number[]; // Which media items matched
    userIntent: string; // Interpreted instruction
  };
  
  // Disambiguation state
  disambiguation: {
    required: boolean;
    reason: string;
    options: MediaOption[];
  };
}

interface EnhancedMedia {
  // Core identification
  persistentId: string; // UUID that survives across turns
  url: string;
  type: 'image' | 'video' | 'pdf' | 'audio';
  
  // User-facing references
  displayIndex: number; // 1-based index shown to user
  fileName: string;
  uploadTurn: number; // Which message turn it was uploaded
  
  // Content understanding
  semanticTags?: string[]; // e.g., ['car', 'red', 'sports-car']
  generatedPrompt?: string; // If AI-generated, the prompt used
  source: 'user_upload' | 'media_library' | 'ai_generated';
  
  // Reference tracking
  lastReferencedTurn?: number;
  referenceCount: number;
  
  // Role in current operation
  role?: 'primary' | 'reference' | 'mask' | 'style_reference';
}

interface MediaOption {
  media: EnhancedMedia;
  reason: string;
  confidence: number;
}
```

### Reference Resolution Algorithm

```typescript
/**
 * ROBUST MEDIA REFERENCE RESOLVER
 * Handles all ambiguity cases with intelligent fallbacks
 */
function resolveMediaReferences(
  userMessage: string,
  currentTurnUploads: EnhancedMedia[],
  conversationMedia: EnhancedMedia[],
  conversationHistory: Message[]
): RobustMediaContext {
  
  // PHASE 1: Explicit New Uploads (Highest Priority)
  if (currentTurnUploads.length > 0) {
    // User just uploaded/injected media THIS turn
    
    // Single upload: Unambiguous
    if (currentTurnUploads.length === 1) {
      return {
        resolvedMedia: currentTurnUploads,
        resolution: {
          method: 'explicit_upload',
          confidence: 1.0,
          matchedIndices: [currentTurnUploads[0].displayIndex],
          userIntent: 'work_with_newly_uploaded_media'
        },
        disambiguation: { required: false }
      };
    }
    
    // Multiple uploads: Check for disambiguation in text
    const specificMedia = findSpecificMediaFromText(
      userMessage,
      currentTurnUploads
    );
    
    if (specificMedia.length === 1) {
      // User specified which one: "edit the car image"
      return {
        resolvedMedia: specificMedia,
        resolution: {
          method: 'semantic_match',
          confidence: 0.9,
          matchedIndices: specificMedia.map(m => m.displayIndex),
          userIntent: 'work_with_specific_uploaded_media'
        },
        disambiguation: { required: false }
      };
    }
    
    if (specificMedia.length > 1) {
      // Matched multiple, still ambiguous
      return {
        resolvedMedia: [],
        resolution: {
          method: 'ambiguous',
          confidence: 0.3,
          matchedIndices: [],
          userIntent: 'unclear_which_media'
        },
        disambiguation: {
          required: true,
          reason: 'multiple_matches',
          options: specificMedia.map(m => ({
            media: m,
            reason: `Matched: ${m.fileName}`,
            confidence: 0.7
          }))
        }
      };
    }
    
    // No specific match, check if instruction applies to all
    if (isMultiImageOperation(userMessage)) {
      // "combine these images", "create a collage"
      return {
        resolvedMedia: currentTurnUploads,
        resolution: {
          method: 'explicit_upload',
          confidence: 0.8,
          matchedIndices: currentTurnUploads.map(m => m.displayIndex),
          userIntent: 'work_with_all_uploaded_media'
        },
        disambiguation: { required: false }
      };
    }
    
    // Ambiguous - need user to clarify
    return {
      resolvedMedia: [],
      disambiguation: {
        required: true,
        reason: 'multiple_uploads_unclear_target',
        options: currentTurnUploads.map((m, i) => ({
          media: m,
          reason: `Image ${i + 1}: ${m.fileName}`,
          confidence: 1.0 / currentTurnUploads.length
        }))
      }
    };
  }
  
  // PHASE 2: Numeric/Ordinal References
  const numericRef = extractNumericReference(userMessage);
  if (numericRef) {
    const media = conversationMedia.find(m => m.displayIndex === numericRef);
    if (media) {
      return {
        resolvedMedia: [media],
        resolution: {
          method: 'numeric_reference',
          confidence: 1.0,
          matchedIndices: [numericRef],
          userIntent: `reference_to_image_${numericRef}`
        },
        disambiguation: { required: false }
      };
    } else {
      // Referenced image doesn't exist (maybe truncated)
      return {
        resolvedMedia: [],
        disambiguation: {
          required: true,
          reason: 'referenced_image_not_found',
          options: conversationMedia.slice(0, 3).map(m => ({
            media: m,
            reason: `Did you mean Image ${m.displayIndex}?`,
            confidence: 0.5
          }))
        }
      };
    }
  }
  
  // PHASE 3: Recency References ("last image", "previous", "that")
  const recencyRef = extractRecencyReference(userMessage);
  if (recencyRef) {
    const sortedMedia = [...conversationMedia].sort((a, b) => 
      b.uploadTurn - a.uploadTurn
    );
    
    if (recencyRef === 'last' && sortedMedia.length > 0) {
      return {
        resolvedMedia: [sortedMedia[0]],
        resolution: {
          method: 'recency',
          confidence: 0.9,
          matchedIndices: [sortedMedia[0].displayIndex],
          userIntent: 'reference_to_most_recent_media'
        },
        disambiguation: { required: false }
      };
    }
  }
  
  // PHASE 4: Semantic Content Matching
  const semanticMatches = findSemanticMatches(
    userMessage,
    conversationMedia
  );
  
  if (semanticMatches.length === 1) {
    return {
      resolvedMedia: semanticMatches,
      resolution: {
        method: 'semantic_match',
        confidence: 0.8,
        matchedIndices: semanticMatches.map(m => m.displayIndex),
        userIntent: 'semantic_content_match'
      },
      disambiguation: { required: false }
    };
  }
  
  if (semanticMatches.length > 1) {
    // Multiple semantic matches
    return {
      resolvedMedia: [],
      disambiguation: {
        required: true,
        reason: 'multiple_semantic_matches',
        options: semanticMatches.map(m => ({
          media: m,
          reason: `Contains: ${m.semanticTags?.join(', ')}`,
          confidence: 0.6
        }))
      }
    };
  }
  
  // PHASE 5: No Media Reference Detected
  return {
    resolvedMedia: [],
    resolution: {
      method: 'explicit_upload',
      confidence: 0.0,
      matchedIndices: [],
      userIntent: 'no_media_operation'
    },
    disambiguation: { required: false }
  };
}
```

### Multi-Image Role Assignment

```typescript
/**
 * When multiple images are resolved, assign roles for tools
 */
function assignMediaRoles(
  resolvedMedia: EnhancedMedia[],
  userMessage: string,
  toolHint?: string
): EnhancedMedia[] {
  
  if (resolvedMedia.length === 0) return [];
  if (resolvedMedia.length === 1) {
    resolvedMedia[0].role = 'primary';
    return resolvedMedia;
  }
  
  // Multi-image operations
  const operation = detectOperation(userMessage);
  
  switch (operation) {
    case 'edit_with_reference':
      // "edit this image using that style"
      // First = primary, rest = reference
      resolvedMedia[0].role = 'primary';
      resolvedMedia.slice(1).forEach(m => m.role = 'reference');
      break;
      
    case 'mask_edit':
      // "edit using this mask"
      // Look for mask in filename or semantics
      const maskIndex = resolvedMedia.findIndex(m => 
        m.fileName.includes('mask') || m.semanticTags?.includes('mask')
      );
      if (maskIndex !== -1) {
        resolvedMedia[maskIndex].role = 'mask';
        resolvedMedia[0].role = 'primary';
      }
      break;
      
    case 'combine':
      // "combine these images"
      // All images are equal participants
      resolvedMedia.forEach(m => m.role = 'reference');
      break;
      
    case 'compare':
      // "which is better?"
      // Vision analysis, all equal
      resolvedMedia.forEach(m => m.role = 'reference');
      break;
      
    default:
      // Default: first is primary, rest are reference
      resolvedMedia[0].role = 'primary';
      resolvedMedia.slice(1).forEach(m => m.role = 'reference');
  }
  
  return resolvedMedia;
}
```

---

## 🛠️ **IMPLEMENTATION PLAN**

### Phase 1: Enhanced Media Tracking (Frontend)
- Add `persistentId` (UUID) to all media attachments
- Track `uploadTurn` (message number when uploaded)
- Store semantic tags (user-provided or AI-generated)
- Maintain `conversationMedia` registry in context

### Phase 2: Robust Reference Resolution (API Route)
- Implement `resolveMediaReferences()` algorithm
- Add disambiguation detection
- Handle multi-image role assignment
- Improve logging for debugging

### Phase 3: Python Agent Integration
- Update `AgentChatRequest` model with `RobustMediaContext`
- Enhance agent instructions for disambiguation
- Add explicit media numbering in prompt
- Improve tool parameter mapping

### Phase 4: Frontend Disambiguation UI
- Add media selection UI when ambiguous
- Show numbered thumbnails for user selection
- Allow user to specify "primary" vs "reference" images
- Add quick actions: "Edit Image 2", "Combine All"

### Phase 5: Semantic Tagging (Optional Enhancement)
- Use Vision API to tag uploaded images
- Extract objects, colors, scenes
- Enable natural language matching: "the blue car" → finds car image

### Phase 6: Comprehensive Testing
- Test all edge cases identified above
- Multi-image scenarios
- Historical references
- Truncation resilience
- Cross-turn references

---

## ✅ **SUCCESS CRITERIA**

1. **Zero Ambiguity Errors**: System detects and handles all ambiguous cases
2. **100% Reference Accuracy**: Correct image resolved in all test cases
3. **Multi-Image Support**: Can handle 3+ simultaneous images correctly
4. **Graceful Degradation**: Clear error messages when disambiguation needed
5. **Natural Language**: Supports "the blue car", "image 2", "last one", etc.
6. **Cross-Turn Stable**: References work across 10+ message turns
7. **Token-Resilient**: Works even after aggressive history truncation

---

## 📊 **TEST SCENARIOS**

### Scenario 1: Single Image Edit
```
User uploads: [car.jpg]
User: "make it red"
Expected: ✅ car.jpg with "make it red" instruction
```

### Scenario 2: Multi-Image Ambiguous
```
User uploads: [car.jpg, house.jpg, tree.jpg]
User: "make it red"
Expected: ⚠️ Disambiguation prompt: "Which image?"
```

### Scenario 3: Multi-Image Specific
```
User uploads: [car.jpg, house.jpg, tree.jpg]
User: "make the car red"
Expected: ✅ car.jpg with "make the car red" instruction
```

### Scenario 4: Numeric Reference
```
History: [logo.png (image 1), background.png (image 2)]
User: "edit image 1"
Expected: ✅ logo.png
```

### Scenario 5: Combine Operation
```
User uploads: [img1.jpg, img2.jpg]
User: "combine these"
Expected: ✅ Both images with "combine" operation
```

### Scenario 6: Cross-Turn Reference
```
Turn 1: Upload logo.png
Turn 5: "edit the logo to be blue"
Expected: ✅ logo.png with edit instruction
```

### Scenario 7: Semantic Match
```
User uploads: [red_car.jpg, blue_house.jpg]
User: "make the house bigger"
Expected: ✅ blue_house.jpg (matched "house" in semantic tags)
```

---

## 🚀 **NEXT STEPS**

1. Implement `EnhancedMedia` interface
2. Add persistent ID generation
3. Build `resolveMediaReferences()` function
4. Update API route integration
5. Enhance Python agent prompts
6. Add comprehensive test suite
7. Build disambiguation UI (Phase 2)
8. Add semantic tagging (Phase 3)


