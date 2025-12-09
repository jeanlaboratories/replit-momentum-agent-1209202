import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { DEFAULT_SETTINGS } from '@/lib/ai-model-defaults';

const GOOGLE_API_KEY = process.env.MOMENTUM_GOOGLE_API_KEY;

// Character reference schema for consistent character representation across campaign
const CharacterReferenceSchema = z.object({
  id: z.string().describe('Unique identifier for the character'),
  name: z.string().describe('Name/label for the character (e.g., "Main Character", "Brand Mascot")'),
  description: z.string().optional().describe('Brief description of the character'),
  characterSheetUrl: z.string().describe('URL to character sheet image showing multiple angles/poses'),
  isActive: z.boolean().default(true).describe('Whether to use this character in generation'),
});

// Character consistency configuration schema
const CharacterConsistencyConfigSchema = z.object({
  enabled: z.boolean().default(false).describe('Whether to enable character consistency for this campaign'),
  characters: z.array(CharacterReferenceSchema).default([]).describe('Character references for consistency'),
  useSceneToSceneConsistency: z.boolean().default(true).describe('Whether to pass previous scene images for better consistency'),
  maxReferenceImages: z.number().default(14).describe('Max reference images per generation (Nano Banana limit is 14)'),
});

export const CampaignRequestSchema = z.object({
  campaignName: z.string().describe('The name/title of the campaign'),
  duration: z.number().describe('Number of days for the campaign'),
  startDate: z.string().describe('ISO date string for campaign start (YYYY-MM-DD)'),
  postsPerDay: z.number().min(1).max(5).describe('Number of posts per day (1-5)'),
  contentTypes: z.array(z.enum(['Social Media Post', 'Email Newsletter', 'Blog Post Idea'])).describe('Types of content to include'),
  tones: z.array(z.enum(['Professional', 'Playful', 'Urgent'])).describe('Tones to use across the campaign'),
  campaignGoal: z.string().optional().describe('The main goal or objective of the campaign'),
  postDistribution: z.enum(['even', 'increasing', 'decreasing', 'peak-middle']).default('even').describe('How to distribute posts across days'),
  keyMessages: z.array(z.string()).optional().describe('Specific key messages/prompts for individual posts'),
  scheduledTimes: z.array(z.string()).optional().describe('Scheduled times for posts (format: HH:mm)'),
  imageAssignments: z.array(z.object({
    imageIndex: z.number().describe('Index of the image in the provided images array'),
    dayNumber: z.number().optional().describe('Day number to assign the image to (1-based). If not specified, assign sequentially starting from day 1, post 1'),
    postNumber: z.number().optional().describe('Post number within the day to assign the image to (1-based). If not specified, assign to first post of the day'),
  })).optional().describe('Assignments of provided images to specific days/posts'),
  // Character consistency configuration
  characterConsistency: CharacterConsistencyConfigSchema.optional().describe('Configuration for maintaining character consistency across campaign images'),
});

export type CampaignRequest = z.infer<typeof CampaignRequestSchema>;

const CAMPAIGN_CREATION_PROMPT = `You are a campaign planning expert. Your job is to parse natural language campaign requests and extract structured information.

Given a user's campaign request, extract and return the following information in JSON format:

1. **campaignName**: A concise, descriptive name for the campaign (if not specified, generate one based on the request)
2. **duration**: Number of days for the campaign
3. **startDate**: The start date in ISO format (YYYY-MM-DD). If the user says:
   - "tomorrow" → calculate tomorrow's date
   - "next Monday/Tuesday/etc" → calculate the next occurrence of that day
   - "in 3 days" → calculate 3 days from today
   - "December 1" or "Dec 1" → use the current year unless specified
   - "today" or "starting today" → use today's date
   - If no date is specified, use today as the default
4. **postsPerDay**: Number of posts per day (default to 2-3 if not specified)
5. **contentTypes**: Array of content types. Default to ['Social Media Post'] if not specified. Options: 'Social Media Post', 'Email Newsletter', 'Blog Post Idea'
6. **tones**: Array of tones to vary across the campaign. Default to ['Professional', 'Playful'] if not specified. Options: 'Professional', 'Playful', 'Urgent'
7. **campaignGoal**: The main objective (extract from context if mentioned)
8. **postDistribution**: How to distribute posts:
   - "even" → same number of posts each day (default)
   - "increasing" → gradually increase posts toward the end
   - "decreasing" → more posts at the start, fewer at the end
   - "peak-middle" → more posts in the middle days
9. **keyMessages**: (Optional) Array of specific key messages or prompts for individual posts. Extract if user provides specific messages for each post.
10. **scheduledTimes**: (Optional) Array of scheduled times for posts in HH:mm format (e.g., ["09:00", "14:00", "18:00"]). Extract if user specifies posting times.
11. **imageAssignments**: (Optional) Array of image assignments if user mentions images. Format:
    - If user says "use this image for day 2, post 1" → [{imageIndex: 0, dayNumber: 2, postNumber: 1}]
    - If user says "use these images for the campaign" (no specific assignment) → [{imageIndex: 0}, {imageIndex: 1}, ...] (system will assign sequentially)
    - If user provides multiple images without specification, create assignments for each: [{imageIndex: 0}, {imageIndex: 1}, {imageIndex: 2}]
    - imageIndex is 0-based (first image = 0, second = 1, etc.)
    - dayNumber and postNumber are 1-based (day 1 = first day, post 1 = first post of the day)

Today's date is: ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}
Current day of week: ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}

Examples:

User: "Create a 7-day product launch campaign starting next Monday"
Output: {
  "campaignName": "Product Launch Campaign",
  "duration": 7,
  "startDate": "[next Monday's date in YYYY-MM-DD]",
  "postsPerDay": 2,
  "contentTypes": ["Social Media Post"],
  "tones": ["Professional", "Playful"],
  "postDistribution": "increasing"
}

User: "Build a 2-week holiday sale with 3 posts daily starting December 1st"
Output: {
  "campaignName": "Holiday Sale Campaign",
  "duration": 14,
  "startDate": "[current year]-12-01",
  "postsPerDay": 3,
  "contentTypes": ["Social Media Post", "Email Newsletter"],
  "tones": ["Playful", "Urgent"],
  "campaignGoal": "Drive holiday sales",
  "postDistribution": "peak-middle"
}

User: "30-day brand awareness campaign with blog posts and social media"
Output: {
  "campaignName": "Brand Awareness Campaign",
  "duration": 30,
  "startDate": "[tomorrow's date]",
  "postsPerDay": 2,
  "contentTypes": ["Social Media Post", "Blog Post Idea"],
  "tones": ["Professional", "Playful"],
  "campaignGoal": "Increase brand awareness",
  "postDistribution": "even"
}

Return ONLY valid JSON matching the schema. Do not include any explanatory text.`;

export async function parseCampaignRequest(
  naturalLanguageRequest: string,
  media?: Array<{ type: string; data?: string; url?: string }>
): Promise<CampaignRequest> {
  if (!GOOGLE_API_KEY) {
    throw new Error('Google API key not configured');
  }

  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
  // Use the default text model from centralized settings
  const model = genAI.getGenerativeModel({
    model: DEFAULT_SETTINGS.textModel,
    systemInstruction: CAMPAIGN_CREATION_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  try {
    // Prepare the content parts
    const parts: any[] = [];

    // Add media if provided
    if (media && media.length > 0) {
      const mediaContext = `\n\n[The user has provided ${media.length} image(s) for this campaign.]`;
      naturalLanguageRequest = naturalLanguageRequest + mediaContext;

      for (const m of media) {
        let base64Data;
        if (m.data) {
          base64Data = m.data.split(',')[1] || m.data;
        } else if (m.url) {
          try {
            const response = await fetch(m.url);
            const arrayBuffer = await response.arrayBuffer();
            base64Data = Buffer.from(arrayBuffer).toString('base64');
          } catch (error) {
            console.error('Failed to fetch media from URL:', m.url, error);
            continue;
          }
        } else {
          continue;
        }

        parts.push({
          inlineData: {
            mimeType: m.type === 'image' ? 'image/png' : 'video/mp4',
            data: base64Data,
          },
        });
      }
    }

    // Add the text prompt
    parts.push({ text: naturalLanguageRequest });

    const result = await model.generateContent(parts);
    const response = result.response.text();

    let parsedData = JSON.parse(response);

    // If Gemini returns an array, take the first element
    if (Array.isArray(parsedData)) {
      if (parsedData.length > 0) {
        parsedData = parsedData[0];
      } else {
        // Empty array - create default event
        parsedData = {
          campaignName: "Event",
          duration: 1,
          startDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
          postsPerDay: 2,
          contentTypes: ["Social Media Post"],
          tones: ["Professional"],
          postDistribution: "even"
        };
      }
    }

    // If media was provided but no imageAssignments in response, create default assignments
    if (media && media.length > 0 && !parsedData.imageAssignments) {
      parsedData.imageAssignments = media.map((_, index) => ({ imageIndex: index }));
    }

    const validatedData = CampaignRequestSchema.parse(parsedData);

    return validatedData;
  } catch (error) {
    console.error('Error parsing campaign request:', error);
    console.error('Raw response:', error);
    throw new Error(`Failed to parse campaign request: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function calculatePostSchedule(
  duration: number,
  postsPerDay: number,
  distribution: CampaignRequest['postDistribution']
): number[] {
  const schedule: number[] = [];
  
  switch (distribution) {
    case 'even':
      for (let i = 0; i < duration; i++) {
        schedule.push(postsPerDay);
      }
      break;
      
    case 'increasing':
      const minPosts = Math.max(1, Math.floor(postsPerDay * 0.6));
      for (let i = 0; i < duration; i++) {
        const ratio = i / (duration - 1);
        const posts = Math.round(minPosts + (postsPerDay - minPosts) * ratio);
        schedule.push(posts);
      }
      break;
      
    case 'decreasing':
      const maxPosts = postsPerDay;
      const endPosts = Math.max(1, Math.floor(postsPerDay * 0.6));
      for (let i = 0; i < duration; i++) {
        const ratio = i / (duration - 1);
        const posts = Math.round(maxPosts - (maxPosts - endPosts) * ratio);
        schedule.push(posts);
      }
      break;
      
    case 'peak-middle':
      const middle = Math.floor(duration / 2);
      for (let i = 0; i < duration; i++) {
        const distanceFromMiddle = Math.abs(i - middle);
        const ratio = 1 - (distanceFromMiddle / middle);
        const posts = Math.max(1, Math.round(postsPerDay * ratio));
        schedule.push(posts);
      }
      break;
  }
  
  return schedule;
}

export function generateContentBlockInstructions(
  campaignGoal?: string,
  contentTypes?: string[],
  tones?: string[]
): { contentType: string; keyMessage: string; toneOfVoice: string }[] {
  const blocks: { contentType: string; keyMessage: string; toneOfVoice: string }[] = [];
  const types = contentTypes || ['Social Media Post'];
  const availableTones = tones || ['Professional', 'Playful'];

  const goalContext = campaignGoal ? `Campaign goal: ${campaignGoal}. ` : '';

  const messageTemplates = [
    `${goalContext}Create engaging content that captures attention`,
    `${goalContext}Share valuable information with the audience`,
    `${goalContext}Build excitement and anticipation`,
    `${goalContext}Highlight key benefits and features`,
    `${goalContext}Encourage audience interaction and engagement`,
  ];

  types.forEach(type => {
    const message = messageTemplates[Math.floor(Math.random() * messageTemplates.length)];
    const tone = availableTones[Math.floor(Math.random() * availableTones.length)];

    blocks.push({
      contentType: type,
      keyMessage: message,
      toneOfVoice: tone as 'Professional' | 'Playful' | 'Urgent',
    });
  });

  return blocks;
}

/**
 * Assigns images to content blocks based on image assignments
 * If no specific day/post is specified, assigns sequentially starting from day 1, post 1
 */
export function assignImagesToContentBlocks(
  imageUrls: string[],
  imageAssignments: CampaignRequest['imageAssignments'],
  postSchedule: number[]
): Map<string, string> {
  const imageMap = new Map<string, string>(); // Key: "day-post" (e.g., "1-1", "2-2"), Value: imageUrl

  if (!imageAssignments || imageAssignments.length === 0) {
    // If no assignments specified, assign images sequentially
    let imageIndex = 0;
    let dayNumber = 1;
    let postNumber = 1;

    while (imageIndex < imageUrls.length && dayNumber <= postSchedule.length) {
      const key = `${dayNumber}-${postNumber}`;
      imageMap.set(key, imageUrls[imageIndex]);
      imageIndex++;

      // Move to next post/day
      postNumber++;
      if (postNumber > postSchedule[dayNumber - 1]) {
        dayNumber++;
        postNumber = 1;
      }
    }
  } else {
    // Process explicit assignments
    const sequentialAssignments: number[] = [];

    for (const assignment of imageAssignments) {
      if (assignment.dayNumber && assignment.postNumber) {
        // Explicit assignment
        const key = `${assignment.dayNumber}-${assignment.postNumber}`;
        imageMap.set(key, imageUrls[assignment.imageIndex]);
      } else {
        // Queue for sequential assignment
        sequentialAssignments.push(assignment.imageIndex);
      }
    }

    // Assign queued images sequentially
    if (sequentialAssignments.length > 0) {
      let dayNumber = 1;
      let postNumber = 1;

      for (const imageIndex of sequentialAssignments) {
        // Skip positions that already have images
        while (dayNumber <= postSchedule.length) {
          const key = `${dayNumber}-${postNumber}`;
          if (!imageMap.has(key)) {
            imageMap.set(key, imageUrls[imageIndex]);
            break;
          }

          // Move to next position
          postNumber++;
          if (postNumber > postSchedule[dayNumber - 1]) {
            dayNumber++;
            postNumber = 1;
          }
        }

        // Move to next position after assignment
        postNumber++;
        if (postNumber > postSchedule[dayNumber - 1]) {
          dayNumber++;
          postNumber = 1;
        }
      }
    }
  }

  return imageMap;
}
