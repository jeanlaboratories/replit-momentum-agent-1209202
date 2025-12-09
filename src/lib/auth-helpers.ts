import { headers } from 'next/headers';

function getServiceToken(): string {
  const token = process.env.MOMENTUM_SERVICE_TOKEN;
  
  if (token) {
    return token;
  }
  
  if (process.env.NODE_ENV === 'development') {
    return 'dev-service-token-change-in-production';
  }
  
  throw new Error('MOMENTUM_SERVICE_TOKEN must be set in production');
}

export interface ServiceAuthContext {
  userId: string;
  brandId: string;
  isServiceCall: boolean;
}

export async function verifyServiceToken(): Promise<ServiceAuthContext | null> {
  const headersList = await headers();
  const serviceToken = headersList.get('x-service-token');
  const userId = headersList.get('x-user-id');
  const brandId = headersList.get('x-brand-id');

  if (!serviceToken || serviceToken !== getServiceToken()) {
    return null;
  }

  if (!userId || !brandId) {
    throw new Error('Service token requires x-user-id and x-brand-id headers');
  }

  return {
    userId,
    brandId,
    isServiceCall: true,
  };
}

export function createServiceHeaders(userId: string, brandId: string): HeadersInit {
  return {
    'x-service-token': getServiceToken(),
    'x-user-id': userId,
    'x-brand-id': brandId,
  };
}
