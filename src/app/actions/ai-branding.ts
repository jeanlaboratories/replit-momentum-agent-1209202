'use server';

import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import { getBrandSoul } from '@/lib/brand-soul/context';
import { getAdminInstances } from '@/lib/firebase/admin';
import { ai } from '@/ai';
import { z } from 'zod';
import { DEFAULT_SETTINGS } from '@/lib/ai-model-defaults';

export interface BrandTheme {
  brandId: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    card: string;
    foreground: string; // Suggested foreground for background
    cardForeground: string; // Suggested foreground for card
    primaryForeground?: string; // Suggested foreground for primary
    heroForeground?: string; // New: Foreground for hero gradient
  };
  gradients: {
    hero: string;
    feature: string;
  };
  description: string;
  sourceColors: string[]; // Existing team colors that influenced this branding (empty array if none found)
  createdAt: Date;
}

export async function generateAIBrandingAction(brandId: string) {
  try {
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);
    
    const brandSoul = await getBrandSoul(brandId);
    
    // Collect existing team colors from Brand Soul
    const existingColors: string[] = [];
    if (brandSoul?.visualIdentity?.colors) {
      const { primary, secondary, accent } = brandSoul.visualIdentity.colors;
      // Handle both array and single string values
      if (primary) {
        if (Array.isArray(primary)) {
          existingColors.push(...primary);
        } else if (typeof primary === 'string') {
          existingColors.push(primary);
        }
      }
      if (secondary) {
        if (Array.isArray(secondary)) {
          existingColors.push(...secondary);
        } else if (typeof secondary === 'string') {
          existingColors.push(secondary);
        }
      }
      if (accent) {
        if (Array.isArray(accent)) {
          existingColors.push(...accent);
        } else if (typeof accent === 'string') {
          existingColors.push(accent);
        }
      }
    }
    
    // Fetch extracted colors from artifacts (using correct subcollection structure)
    const { adminDb } = getAdminInstances();
    const artifactsSnapshot = await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .limit(20)
      .get();
    
    let artifactCount = 0;
    artifactsSnapshot.forEach((doc: any) => {
      if (artifactCount >= 5) return; // Limit to 5 artifacts with colors
      
      const artifact = doc.data();
      if (artifact.metadata?.extractedColors) {
        const colors = artifact.metadata.extractedColors;
        if (Array.isArray(colors)) {
          // Extract hex values from color objects
          const hexColors = colors.map(c => {
            if (typeof c === 'object' && c.hex) {
              return c.hex; // Extract hex from color object
            }
            return c; // Already a string
          }).filter(Boolean);
          existingColors.push(...hexColors);
          artifactCount++;
        } else if (typeof colors === 'string') {
          existingColors.push(colors);
          artifactCount++;
        }
      }
    });
    
    // Deduplicate colors and limit to 10
    const uniqueColors = Array.from(new Set(existingColors)).slice(0, 10);
    console.log(`[AIBranding] Found ${uniqueColors.length} unique team colors:`, uniqueColors);
    
    const colorsContext = uniqueColors.length > 0
      ? `\n\nEXISTING TEAM COLORS (use these as inspiration or incorporate them):\n${uniqueColors.join(', ')}`
      : '';
    
    const promptText = `You are a world-class brand designer. Create a stylish, modern, and premium visual brand identity.
The design should focus on stylish simplicity, clean lines, and high readability, while incorporating the team's identity.

TEAM INFORMATION:
${brandSoul?.messagingFramework?.mission ? `Mission: ${brandSoul.messagingFramework.mission}` : ''}
${brandSoul?.messagingFramework?.vision ? `Vision: ${brandSoul.messagingFramework.vision}` : ''}
${brandSoul?.voiceProfile?.personality ? `Personality: ${JSON.stringify(brandSoul.voiceProfile.personality)}` : ''}${colorsContext}

INSTRUCTIONS:
1. BACKGROUNDS MUST BE LIGHT: Use very light, subtle colors for the background and card elements (lightness 95-98%). This is crucial for text readability and matches the default theme's clean look.
2. ACCENT COLORS: Use the team's colors for primary and accent elements.
3. HERO GRADIENT (CRITICAL FOR HEADER BANNER):
   - Create a smooth, horizontal linear gradient for the Team Companion header banner.
   - Use "linear-gradient(to right, color1, color2)" - a horizontal gradient flowing left to right.
   - The gradient should use RICH, SATURATED colors (deep purples, magentas, blues, teals, etc.) - NOT light pastel colors.
   - Ensure the gradient is DARK or VIBRANT enough that WHITE text will be clearly readable on top of it.
   - Example of good gradient: "linear-gradient(to right, hsl(280, 70%, 35%), hsl(320, 65%, 50%))" (deep purple to magenta)
   - The gradient transition should be smooth and even across the banner.
4. HIGH CONTRAST: Ensure that the foreground colors you suggest are DARK (e.g., dark gray or dark version of primary color) to ensure high contrast against the light backgrounds.
5. PRIMARY CONTRAST: If the primary color is light (like yellow or light blue), provide a DARK primaryForeground. If the primary color is dark, provide a LIGHT primaryForeground.
6. HERO FOREGROUND (CRITICAL): ALWAYS use WHITE "hsl(0, 0%, 100%)" for heroForeground. This is essential for maximum readability. The Team Companion header text, icons, and sparkles MUST be solid white against the gradient background.
7. ${uniqueColors.length > 0
        ? `This team already has established brand colors: ${uniqueColors.join(', ')}. You MUST incorporate these colors into the primary, secondary, or accent colors, AND use them as inspiration for the hero gradient. Do not ignore them.`
      : `Create a professional color scheme that makes this team stand out.`
}

Return JSON with HSL colors:
{
  "primary": "hsl(hue, saturation%, lightness%)", // Team primary color or main accent
  "secondary": "hsl(...)", // Team secondary color or complementary accent
  "accent": "hsl(...)", // Another accent color
  "background": "hsl(hue, saturation%, 95-98%)", // MUST BE VERY LIGHT
  "card": "hsl(hue, saturation%, 98-100%)", // MUST BE VERY LIGHT, almost white
  "foreground": "hsl(hue, saturation%, 10-15%)", // MUST BE DARK for contrast
  "cardForeground": "hsl(hue, saturation%, 10-15%)", // MUST BE DARK for contrast
  "primaryForeground": "hsl(hue, saturation%, lightness%)", // Contrasts with primary
  "heroForeground": "hsl(0, 0%, 100%)", // MUST BE WHITE for readability on gradient
  "heroGradient": "linear-gradient(to right, color1, color2)", // HORIZONTAL gradient with rich/saturated colors
  "featureGradient": "linear-gradient(to right, color1, color2)", // Horizontal gradient
  "description": "Why these colors capture this team's essence"
}`;

    const genPrompt = ai.definePrompt({
      name: 'generateBrandColors',
      // Use the default text model from centralized settings
      model: `googleai/${DEFAULT_SETTINGS.textModel}`,
      config: {
        temperature: 1.3,
      },
      input: {
        schema: z.object({
          brandContext: z.string(),
        }),
      },
      output: {
        format: 'json',
        schema: z.object({
          primary: z.string(),
          secondary: z.string(),
          accent: z.string(),
          background: z.string(),
          card: z.string(),
          foreground: z.string(),
          cardForeground: z.string(),
          primaryForeground: z.string(),
          heroForeground: z.string(),
          heroGradient: z.string(),
          featureGradient: z.string(),
          description: z.string(),
        }),
      },
      prompt: `{{{brandContext}}}`,
    });

    const result = await genPrompt({ brandContext: promptText });
    const theme = result.output;

    if (!theme) {
      return { error: 'Failed to generate branding' };
    }

    const brandTheme: BrandTheme = {
      brandId,
      colors: {
        primary: theme.primary,
        secondary: theme.secondary,
        accent: theme.accent,
        background: theme.background,
        card: theme.card,
        foreground: theme.foreground,
        cardForeground: theme.cardForeground,
        primaryForeground: theme.primaryForeground,
        heroForeground: theme.heroForeground,
      },
      gradients: {
        hero: theme.heroGradient,
        feature: theme.featureGradient,
      },
      description: theme.description,
      sourceColors: uniqueColors, // Always save array (empty or populated) for transparency
      createdAt: new Date(),
    };

    await adminDb.collection('brandThemes').doc(brandId).set(brandTheme);

    return { success: true, theme: brandTheme, sourceColors: uniqueColors };
  } catch (error: any) {
    console.error('[AIBranding] Error:', error);
    return { error: error.message || 'Failed to generate branding' };
  }
}

export async function getBrandThemeAction(brandId: string) {
  try {
    const { adminDb } = getAdminInstances();
    const doc = await adminDb.collection('brandThemes').doc(brandId).get();
    
    if (!doc.exists) {
      return { theme: null };
    }
    
    return { theme: doc.data() as BrandTheme };
  } catch (error: any) {
    console.error('[AIBranding] Error fetching theme:', error);
    return { error: error.message };
  }
}

export async function deleteBrandThemeAction(brandId: string) {
  try {
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();
    await adminDb.collection('brandThemes').doc(brandId).delete();

    return { success: true };
  } catch (error: any) {
    console.error('[AIBranding] Error deleting theme:', error);
    return { error: error.message || 'Failed to delete branding' };
  }
}

export async function updateBrandThemeAction(brandId: string, theme: BrandTheme) {
  try {
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();
    await adminDb.collection('brandThemes').doc(brandId).update({
      ...theme,
      updatedAt: new Date().toISOString(),
    });
    return { success: true, theme };
  } catch (error: any) {
    console.error('[AI Branding] Error updating theme:', error);
    return { error: error.message || 'Failed to update brand theme' };
  }
}
