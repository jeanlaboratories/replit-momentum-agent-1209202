# Context Window Analysis - Can We Run Out?

**Date:** Dec 4, 2025  
**Status:** ⚠️ **POTENTIAL ISSUE WITH MULTIMODAL IMAGES**

---

## 🎯 Quick Answer

**YES, you CAN run out of context, especially with the new multimodal vision feature.**

Here's why and what to do about it:

---

## 📊 Current Context Budget

### Gemini 2.0 Flash Total Capacity:
- **Maximum:** ~1,048,575 tokens (~1M)

### Our Current Allocation:

```typescript
// Constants in chat-context-utils.ts
MAX_CONTEXT_TOKENS = 400,000 tokens  // For message history

// Additional context added:
- Team Intelligence:     ~50-100K tokens
- System prompts:        ~10-50K tokens  
- AI response buffer:    ~50K tokens
- Multimodal images:     ~100-300K tokens PER IMAGE

// With aggressive truncation (when media present):
- Message history:       200K tokens (50% of 400K)
- Team Intelligence:     ~50-100K
- System prompts:        ~10-50K
- ONE multimodal image:  ~100-300K
- AI response:           ~50K
-----------------------------------
TOTAL:                   ~410K - 700K tokens
```

**This is within 1M limit for single images.** ✅

---

## ⚠️ **Potential Issues**

### 1. **Multiple Multimodal Images**

**Problem:**
```
Scenario: User uploads 3 high-resolution images

Context breakdown:
- Message history:       200K tokens
- Team Intelligence:     100K tokens
- System prompts:        30K tokens
- Image 1 (multimodal):  250K tokens
- Image 2 (multimodal):  250K tokens
- Image 3 (multimodal):  250K tokens
- AI response buffer:    50K tokens
-----------------------------------
TOTAL:                   1,130K tokens ❌ EXCEEDS 1M!
```

**Current Code:**
The multimodal part construction in `routers/agent.py` (lines 163-213) downloads and adds ALL uploaded media as multimodal parts without checking total size.

```python
for media in request.media:  # ❌ No limit on count or size
    media_bytes = await download(media.url)
    message_parts.append(types.Part.from_bytes(data=media_bytes))  # ❌ Could be huge
```

---

### 2. **Long Conversations with Images**

**Problem:**
```
Scenario: 50-message conversation, each with 1 image

Without multimodal:
- 50 messages with URLs only: ~100K tokens ✅

With multimodal (current):
- Latest message + image: 250K tokens
- Previous 49 messages (stripped): ~50K tokens  
- Team Intelligence: 100K tokens
-----------------------------------
TOTAL: ~400K tokens ✅ (within limit because old images stripped)
```

**Current Protection:**
Lines 144-163 in `chat-context-utils.ts` strip media from older messages, which helps!

```typescript
// Keep media only in the most recent 2-3 messages
const isRecent = (messages.length - 1 - i) < 3;
if (!isRecent && message.media && message.media.length > 0) {
  // Strip media from older messages
  const strippedMessage = { ...message, media: undefined };
  result.unshift(strippedMessage);
}
```

---

### 3. **Team Intelligence Growth**

**Problem:**
```
As teams add more Brand Soul artifacts, Team Intelligence grows:
- 10 artifacts:  ~50K tokens ✅
- 50 artifacts:  ~100K tokens ✅
- 100 artifacts: ~200K tokens ⚠️
- 500 artifacts: ~500K tokens ❌ Problem!
```

**Current Protection:**
The AI Assistant Context has caching and limits, but could still grow large.

---

## 🛡️ **Current Protections**

### ✅ What We Have:

1. **Message History Truncation:**
   - Max 400K tokens for messages
   - Reduced to 200K when media present
   - Oldest messages dropped first

2. **Media Stripping:**
   - Media removed from messages older than 3 turns
   - Only keeps recent media in history

3. **Aggressive Truncation with Media:**
   - 50% reduction when `hasNewMedia = true`
   - Leaves room for multimodal images

4. **Content Truncation:**
   - Individual messages truncated if too large
   - Keeps most recent content

---

## ⚠️ **What's Missing**

### Protections Needed:

1. **Multimodal Image Count Limit:**
   ```python
   # Should limit number of images sent as multimodal parts
   MAX_MULTIMODAL_IMAGES = 3  # Only send 3 most recent as multimodal
   ```

2. **Multimodal Image Size Limit:**
   ```python
   # Should skip very large images or resize them
   MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB limit
   ```

3. **Total Context Monitoring:**
   ```python
   # Should estimate total context before sending
   total_estimated = (
       message_tokens +
       team_intelligence_tokens +
       system_prompt_tokens +
       multimodal_image_tokens
   )
   if total_estimated > 900_000:  # Leave margin
       # Reduce something
   ```

---

## 🎯 **Scenarios & Risk Assessment**

### ✅ LOW RISK (Safe):

**1. Text-only conversations:**
- Messages: 400K tokens
- Team Intelligence: 100K
- System: 50K
- **Total: ~550K** ✅

**2. Single image per turn:**
- Messages: 200K tokens (aggressive truncation)
- Image: 200K tokens
- Team Intelligence: 100K
- System: 50K
- **Total: ~550K** ✅

**3. Normal usage (occasional images):**
- History keeps only recent 3 images
- Older messages stripped
- **Total: ~600K** ✅

---

### ⚠️ MEDIUM RISK (Possible):

**1. Multiple images in one turn:**
- 3 images @ 200K each = 600K
- Messages: 200K
- Team Intelligence: 100K
- **Total: ~900K** ⚠️ Close to limit

**2. Large Team Intelligence:**
- 200+ artifacts could be 200K+ tokens
- With images: Could approach limit

---

### ❌ HIGH RISK (Likely to fail):

**1. Many high-res images:**
- User uploads 5+ large images
- Each 300K tokens
- **Total: 1.5M+** ❌ Exceeds limit

**2. Rapid image conversation:**
- User asks multiple questions about different images
- Each new turn adds multimodal images
- Could accumulate quickly

---

## 💡 **Recommendations**

### Immediate Fixes Needed:

1. **Limit Multimodal Images:**
   ```python
   # In routers/agent.py, only send recent N images as multimodal
   MAX_MULTIMODAL_IMAGES = 3
   
   # Sort by relevance/recency, take top 3
   media_to_send = request.media[:MAX_MULTIMODAL_IMAGES]
   ```

2. **Add Size Checks:**
   ```python
   if len(media_bytes) > 5 * 1024 * 1024:  # 5MB
       logger.warning(f"Image too large for multimodal, using URL only")
       continue  # Skip multimodal, rely on URL in text
   ```

3. **Monitor Total Context:**
   ```python
   estimated_total = (
       len(message_parts) * 200_000 +  # Rough estimate per part
       team_intelligence_size +
       50_000  # Buffer
   )
   if estimated_total > 900_000:
       # Remove oldest multimodal images
   ```

---

## 🎯 **Current Status**

### What Happens Now if Context Exceeded:

**Gemini API will return an error:**
```
Error: Request exceeds maximum context length
```

**User sees:**
```
"Failed to get response" or similar error
```

**No graceful degradation currently implemented.**

---

## ✅ **Recommended Action Plan**

### Priority 1 (Critical):
- [ ] Add `MAX_MULTIMODAL_IMAGES = 3` limit
- [ ] Add image size check (skip if > 5MB)
- [ ] Log warnings when approaching limits

### Priority 2 (Important):
- [ ] Implement total context estimation
- [ ] Graceful degradation (fallback to URL-only)
- [ ] Better error messages for users

### Priority 3 (Nice to have):
- [ ] Image compression/resizing for multimodal
- [ ] Smart image selection (most relevant)
- [ ] Context usage dashboard for users

---

## 📊 **Summary**

**Q: Can we run out of context?**

**A: YES, in these scenarios:**

1. ✅ **Text-only:** NO - plenty of room
2. ✅ **Single image/turn:** NO - safe with aggressive truncation
3. ⚠️ **Multiple images/turn:** MAYBE - depends on image size
4. ❌ **Many large images:** YES - likely to exceed 1M limit
5. ⚠️ **Large Team Intelligence:** MAYBE - if 200+ artifacts

**Current protection:** Message truncation + media stripping  
**Gap:** No limit on multimodal image count/size  
**Risk:** Medium-High for power users with many images  

**Recommendation:** Add multimodal image limits (3 images max, 5MB max per image)

---

**Status:** ⚠️ **Working but needs limits for production safety**

