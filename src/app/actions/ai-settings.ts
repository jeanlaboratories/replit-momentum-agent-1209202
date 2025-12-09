
'use server';

import { getAdminInstances } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import { revalidatePath } from 'next/cache';
import { DEFAULT_SETTINGS, type AIModelSettings } from '@/lib/ai-model-defaults';

// Re-export the type for convenience (types can be exported from "use server" files)
export type { AIModelSettings } from '@/lib/ai-model-defaults';

export async function getAIModelSettingsAction(brandId: string): Promise<AIModelSettings> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();
    const doc = await adminDb.collection('brands').doc(brandId).collection('settings').doc('ai-models').get();

    if (!doc.exists) {
      return DEFAULT_SETTINGS;
    }

    const data = doc.data() as AIModelSettings;
    return {
      ...DEFAULT_SETTINGS,
      ...data,
    };
  } catch (error) {
    console.error('[Get AI Model Settings] Error:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function updateAIModelSettingsAction(
  brandId: string,
  settings: Partial<AIModelSettings>
): Promise<{ success: boolean; error?: string }> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();
    await adminDb
      .collection('brands')
      .doc(brandId)
      .collection('settings')
      .doc('ai-models')
      .set(settings, { merge: true });

    revalidatePath('/settings');
    return { success: true };
  } catch (error: any) {
    console.error('[Update AI Model Settings] Error:', error);
    return { success: false, error: error.message };
  }
}
