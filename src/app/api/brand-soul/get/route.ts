// Brand Soul - Get Synthesized Brand Soul API
// Returns the latest synthesized brand soul for a specific brand

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json(
        { success: false, message: 'Brand ID is required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated and has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();
    
    const brandSoulDoc = await adminDb
      .collection('brandSoul')
      .doc(brandId)
      .get();

    if (!brandSoulDoc.exists) {
      return NextResponse.json({
        success: true,
        brandSoul: null,
        message: 'No Brand Soul found for this brand',
      });
    }

    const brandSoulData = brandSoulDoc.data();

    if (!brandSoulData) {
      return NextResponse.json({
        success: true,
        brandSoul: null,
      });
    }

    // Transform the new production data structure to UI-friendly format
    const uiBrandSoul: any = {
      id: brandId,
      brandId: brandId,
      version: brandSoulData.stats?.totalSources || 1,
      status: brandSoulData.status || 'published',
      confidence: brandSoulData.stats?.confidenceScore || 0,
      lastUpdated: brandSoulData.lastUpdatedAt || new Date().toISOString(),
    };

    // Map voiceProfile to voice
    if (brandSoulData.voiceProfile) {
      uiBrandSoul.voice = {
        tone: brandSoulData.voiceProfile.tone?.primary 
          ? [brandSoulData.voiceProfile.tone.primary, ...(brandSoulData.voiceProfile.tone.secondary || [])]
          : [],
        style: brandSoulData.voiceProfile.writingStyle 
          ? [brandSoulData.voiceProfile.writingStyle.sentenceLength || 'varied']
          : [],
        values: brandSoulData.voiceProfile.personality?.traits?.map((t: any) => t.name) || [],
        personality: brandSoulData.voiceProfile.personality?.traits?.map((t: any) => t.name) || [],
      };
    }

    // Map factLibrary to facts array
    if (brandSoulData.factLibrary?.facts) {
      uiBrandSoul.facts = brandSoulData.factLibrary.facts.map((f: any) => ({
        category: f.category || 'General',
        fact: f.fact,
        confidence: f.confidence || 80,
      }));
    }

    // Map messagingFramework to messages array
    if (brandSoulData.messagingFramework?.keyMessages) {
      uiBrandSoul.messages = brandSoulData.messagingFramework.keyMessages.flatMap((km: any) => 
        km.messages.map((msg: string) => ({
          message: msg,
          context: km.theme || 'General',
          importance: km.importance || 5,
        }))
      );
    }

    // Map visualIdentity to visual
    if (brandSoulData.visualIdentity) {
      uiBrandSoul.visual = {
        colors: brandSoulData.visualIdentity.colors?.primary || [],
        imagery: brandSoulData.visualIdentity.imageStyle?.subjects || [],
        designPrinciples: brandSoulData.visualIdentity.imageStyle?.style 
          ? [brandSoulData.visualIdentity.imageStyle.style]
          : [],
      };
    }

    return NextResponse.json({
      success: true,
      brandSoul: uiBrandSoul,
    });

  } catch (error) {
    console.error('[Brand Soul API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
