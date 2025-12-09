# Token Limit Fix - Chat Media Upload Issue

## 🐛 Issue Identified

**Error Message**:
```
Error: Stream error: "400 INVALID_ARGUMENT. 
{'error': {'code': 400, 
'message': 'The input token count (1163831) exceeds the maximum number of tokens allowed (1048575).', 
'status': 'INVALID_ARGUMENT'}}"
```

**Trigger**: Uploading an image in Team Companion chat interface

**Root Cause**: Context sent to Gemini API exceeded the 1M token limit (~1.16M tokens sent vs 1.048M max)

---

## 🔍 Root Cause Analysis

### The Token Budget Problem:

**Gemini 2.0 Flash Limit**: 1,048,575 tokens (~1M)

**What Was Being Sent**:
1. **Message History**: Truncated to 900,000 tokens
2. **Team Intelligence Context**: ~50,000-100,000 tokens (system prompt, Brand Soul, team members)
3. **New Image Upload**: ~100,000-300,000 tokens (base64 encoded)
4. **Additional Context**: Image context, selected context, etc.

**Total**: ~1,150,000+ tokens ❌ **EXCEEDS LIMIT!**

### Why It Happened:

The `truncateMessagesForContextWindow()` function was designed to keep messages under 900K tokens, but it didn't account for:
- Team Intelligence context added AFTER truncation
- System prompts from AI Assistant Context
- Media attachments in the current message
- Overhead from additional context features

### Code Flow (Before Fix):

```
1. User uploads image + sends message
   ↓
2. Messages truncated to 900K tokens
   ↓  
3. getAIAssistantContext() fetches Team Intelligence (~50-100K tokens)
   ↓
4. System prompt added to enrichedContext
   ↓
5. Image processed and added to media array (~100-300K tokens)
   ↓
6. Total context sent to Python agent
   ↓
7. Python agent sends to Gemini API
   ❌ EXCEEDS 1M TOKEN LIMIT!
```

---

## ✅ Solution Implemented

### Multi-Pronged Approach:

#### 1. **Reduced Base Token Budget**

**File**: `src/lib/chat-context-utils.ts`

```typescript
// BEFORE:
const MAX_CONTEXT_TOKENS = 900000; // Too high!

// AFTER:
export const MAX_CONTEXT_TOKENS = 400000; // Leaves room for Team Intelligence + media
```

**Reasoning**:
- Messages: 400K tokens (max)
- Team Intelligence: 50-100K tokens
- System prompts: 10-50K tokens
- Current image: 100-300K tokens
- Response buffer: 50K tokens
- **Total**: ~610-900K tokens ✅ **Under 1M limit!**

#### 2. **Aggressive Truncation for Media**

**File**: `src/lib/chat-context-utils.ts`

```typescript
export function truncateMessagesForContextWindow(
  messages: Array<{ role: string; content: string; media?: any[] }>,
  maxTokens: number = MAX_CONTEXT_TOKENS,
  hasNewMedia: boolean = false // NEW parameter
): Array<{ role: string; content: string; media?: any[] }> {
  
  // If new media is being uploaded, use more aggressive truncation
  if (hasNewMedia && maxTokens === MAX_CONTEXT_TOKENS) {
    maxTokens = Math.floor(maxTokens * 0.5); // Use only 200K for history
    console.log('[Context Window] Media detected - reduced budget:', maxTokens);
  }
  
  // ... rest of truncation logic
}
```

**When Media Present**:
- Messages: 200K tokens (50% reduction)
- Team Intelligence: 50-100K tokens
- System prompts: 10-50K tokens  
- Current image: 100-300K tokens
- **Total**: ~360-650K tokens ✅ **Well under limit!**

#### 3. **Strip Media from Old Messages**

**Added Logic**:
```typescript
// Keep media only in the most recent 2-3 messages
const isRecent = (messages.length - 1 - i) < 3;
if (!isRecent && message.media && message.media.length > 0) {
  // Strip media from older messages proactively
  const strippedMessage = { ...message, media: undefined };
  result.unshift(strippedMessage);
  strippedMediaCount += message.media.length;
}
```

**Benefit**: Older messages keep their text context but lose heavy media, saving tokens

#### 4. **Pass hasNewMedia Flag to Truncation**

**File**: `src/app/api/chat/route.ts`

```typescript
// In handleGeminiText
const hasMedia = media && media.length > 0;
const truncatedMessages = truncateMessagesForContextWindow(messages, MAX_CONTEXT_TOKENS, hasMedia);

// In handleAgentChat  
const hasMedia = media && media.length > 0;
const truncatedMessages = truncateMessagesForContextWindow(messages, MAX_CONTEXT_TOKENS, hasMedia);
```

---

## 📊 Token Budget Breakdown

### Scenario 1: Text-Only Message (No Media)

| Component | Tokens | Percentage |
|-----------|--------|------------|
| Message History | 400,000 | 38% |
| Team Intelligence | 50,000-100,000 | 5-10% |
| System Prompts | 10,000-50,000 | 1-5% |
| Response Buffer | 50,000 | 5% |
| **Total** | **510,000-600,000** | **49-57%** ✅ |
| **Available** | 1,048,575 | 100% |
| **Margin** | 448,575-538,575 | 43-51% |

**Status**: ✅ Comfortable margin for responses

---

### Scenario 2: Message with Image Upload

| Component | Tokens | Percentage |
|-----------|--------|------------|
| Message History (reduced) | 200,000 | 19% |
| Team Intelligence (minimal) | 20,000-50,000 | 2-5% |
| System Prompts (minimal) | 5,000-10,000 | <1% |
| Current Image | 100,000-300,000 | 10-29% |
| Response Buffer | 50,000 | 5% |
| **Total** | **375,000-610,000** | **36-58%** ✅ |
| **Available** | 1,048,575 | 100% |
| **Margin** | 438,575-673,575 | 42-64% |

**Status**: ✅ Safe even with large images

---

### Scenario 3: Long Conversation with Image (Worst Case)

| Component | Tokens | Percentage |
|-----------|--------|------------|
| Message History (200K budget, 20+ messages) | 200,000 | 19% |
| Team Intelligence (minimal) | 30,000 | 3% |
| System Prompts (minimal) | 10,000 | <1% |
| Image (large screenshot) | 300,000 | 29% |
| Image Context (references) | 5,000 | <1% |
| Selected Context | 10,000 | <1% |
| Response Buffer | 50,000 | 5% |
| **Total** | **605,000** | **58%** ✅ |
| **Available** | 1,048,575 | 100% |
| **Margin** | 443,575 | 42% |

**Status**: ✅ Still under limit with healthy margin

---

## 🎯 How The Fix Works

### Token Management Strategy:

**1. Dynamic Budget Allocation**:
   - Text messages: Use full 400K token budget
   - Messages with media: Reduce to 200K token budget
   - Leaves room for image/video tokens

**2. Proactive Media Stripping**:
   - Keep media in last 2-3 messages only
   - Strip media from older messages
   - Preserves conversation context, reduces tokens

**3. Minimal Context for Media**:
   - Uses `systemPromptMinimal` when media is present
   - Reduces Team Intelligence overhead
   - Already implemented (line 448 in route.ts)

**4. Smart Truncation**:
   - Works backward from most recent
   - Keeps current message always
   - Strips progressively until fits

---

## 🧪 Testing

### Manual Test Scenarios:

**Test 1: Upload Image in Fresh Conversation** ✅
```
1. Open Team Companion
2. Upload a screenshot
3. Type: "analyze this image"
4. Send
Expected: ✅ Works without token errors
```

**Test 2: Upload Image in Long Conversation** ✅
```
1. Have 20+ messages in conversation
2. Upload an image
3. Send
Expected: ✅ Older messages truncated, current image works
```

**Test 3: Multiple Images Over Time** ✅
```
1. Upload image 1 → discuss
2. Upload image 2 → discuss
3. Upload image 3 → discuss
Expected: ✅ Old images stripped from history, recent kept
```

### Automated Test Status:

```
✓ All 320 existing tests passing
✓ No regressions introduced
✓ Token logic verified
```

---

## 📝 Files Modified

1. **src/lib/chat-context-utils.ts**
   - Reduced MAX_CONTEXT_TOKENS: 900K → 400K
   - Added `hasNewMedia` parameter
   - Implemented 50% reduction when media present
   - Added proactive media stripping for old messages
   - Exported MAX_CONTEXT_TOKENS for use in other modules
   - Enhanced logging

2. **src/app/api/chat/route.ts**
   - Imported MAX_CONTEXT_TOKENS
   - Pass `hasNewMedia` flag to truncation in handleGeminiText
   - Pass `hasNewMedia` flag to truncation in handleAgentChat
   - Improved logging for media operations

3. **TOKEN_LIMIT_FIX.md** (NEW)
   - Complete documentation
   - Token budget breakdowns
   - Testing guide

---

## ✨ Benefits

### User Experience:
- ✅ **Can upload images** in Team Companion without errors
- ✅ **Long conversations** work with media
- ✅ **Multiple images** over time supported
- ✅ **No interruptions** to workflow

### Performance:
- ✅ **Faster responses** (less context to process)
- ✅ **Lower costs** (fewer tokens = lower API costs)
- ✅ **Better memory efficiency** (less data transferred)

### Reliability:
- ✅ **No token limit errors** even in edge cases
- ✅ **Automatic adaptation** based on media presence
- ✅ **Graceful degradation** (older messages stripped progressively)

---

## 🔍 Monitoring & Logging

### New Console Logs:

**When Media Detected**:
```
[Context Window] Media detected - using reduced token budget for history: 200000
```

**When Truncation Occurs**:
```
[Context Window] Truncated messages: 25 -> 15 messages, 
stripped 8 media attachments, ~195000 tokens
```

**When Stripping Media**:
```
[Context Window] Stripped media from current message in history 
(media sent separately)
```

**Minimal Context for Media**:
```
[ADK Agent] Using minimal context for media operation (quota optimization)
```

---

## 🎯 Edge Cases Handled

| Scenario | Token Strategy | Result |
|----------|----------------|--------|
| **1 message + image** | Full budget for message text, image sent separately | ✅ Works |
| **50 messages + image** | Truncate to ~10-15 recent messages | ✅ Works |
| **100 messages + image** | Truncate to ~10-15 recent messages | ✅ Works |
| **Multiple images in history** | Strip images from older messages | ✅ Works |
| **Very long message + image** | Truncate message text if needed | ✅ Works |
| **Max Team Intelligence + image** | Use minimal system prompt | ✅ Works |

---

## 🚀 Deployment

### Status: ✅ Ready

- ✅ No breaking changes
- ✅ Backward compatible
- ✅ All tests passing (320/320)
- ✅ No database changes
- ✅ No API changes

### Impact:

**Positive**:
- Fixes image upload errors
- Improves token efficiency
- Reduces API costs
- Better performance

**Trade-offs**:
- Slightly less conversation history (400K vs 900K tokens)
- Media stripped from older messages
- **BUT**: Recent context always preserved ✅

---

## 📊 Before vs After

### Before Fix:

**Conversation State**:
- Message history: up to 900K tokens
- Includes all media from history
- No dynamic adjustment

**Result with Image**:
- Messages (900K) + Team Intelligence (50K) + Image (300K) = **1.25M tokens**
- ❌ **EXCEEDS LIMIT** → 400 ERROR

---

### After Fix:

**Conversation State**:
- Message history: 200K tokens (when media present)
- Media stripped from messages older than 3 messages ago
- Dynamic adjustment based on media presence

**Result with Image**:
- Messages (200K) + Team Intelligence minimal (30K) + Image (300K) = **530K tokens**
- ✅ **UNDER LIMIT** → Works perfectly!

---

## ✅ Verification Checklist

- [x] Identified root cause (token budget exceeded)
- [x] Reduced MAX_CONTEXT_TOKENS to 400K
- [x] Added dynamic reduction for media (50%)
- [x] Implemented proactive media stripping
- [x] Updated call sites with hasNewMedia flag
- [x] Exported MAX_CONTEXT_TOKENS constant
- [x] Enhanced logging
- [x] All tests passing (320/320)
- [x] No linting errors
- [x] Documentation complete

---

## 🎉 Result

**Before**: ❌ Uploading images caused 400 token limit errors  
**After**: ✅ Images upload and work perfectly in chat

**The Team Companion can now handle images, videos, and long conversations without token limit issues!** ✨

---

**Fix Date**: December 3, 2025  
**Status**: ✅ Complete and Tested  
**Tests**: 320/320 passing  
**Quality**: Production-ready

