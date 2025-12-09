'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useSearchParams } from 'next/navigation';

interface BrandTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    card: string;
    foreground?: string;
    cardForeground?: string;
    primaryForeground?: string;
    heroForeground?: string;
  };
  gradients: {
    hero: string;
    feature: string;
  };
  description: string;
  sourceColors?: string[]; // Existing team colors that influenced this branding (backward compatibility)
}

interface BrandThemeContextType {
  theme: BrandTheme | null;
  loading: boolean;
  refreshTheme: () => Promise<void>;
}

const BrandThemeContext = createContext<BrandThemeContextType>({
  theme: null,
  loading: true,
  refreshTheme: async () => {},
});

export function BrandThemeProvider({ children }: { children: React.ReactNode }) {
  const { brandId: authBrandId } = useAuth();
  const searchParams = useSearchParams();
  const [theme, setTheme] = useState<BrandTheme | null>(null);
  const [loading, setLoading] = useState(true);

  // Try to get brandId from URL if not available from auth
  const brandId = authBrandId || searchParams.get('brandId');

  const fetchTheme = async () => {
    if (!brandId) {
      console.log('[BrandTheme] No brandId found in auth or URL, skipping theme fetch');
      setLoading(false);
      return;
    }

    console.log('[BrandTheme] Fetching theme for brandId:', brandId);
    try {
      const response = await fetch(`/api/brand-theme?brandId=${brandId}`);
      console.log('[BrandTheme] Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[BrandTheme] Data received:', data);
        if (data.theme) {
          console.log('[BrandTheme] Theme found, applying:', data.theme);
          setTheme(data.theme);
          applyTheme(data.theme);
        } else {
          console.log('[BrandTheme] No theme in response');
        }
      }
    } catch (error) {
      console.error('[BrandTheme] Error fetching:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (brandTheme: BrandTheme) => {
    console.log('[BrandTheme] Applying theme to DOM...');
    const root = document.documentElement;
    
    const validateAndExtractHSL = (hsl: string, fallback: string): string => {
      try {
        const match = hsl.match(/hsl\(([^)]+)\)/);
        if (match) {
          return match[1];
        }
        return fallback;
      } catch {
        return fallback;
      }
    };

    const validateGradient = (gradient: string, fallback: string): string => {
      if (gradient && gradient.includes('linear-gradient')) {
        return gradient;
      }
      return fallback;
    };

    const primary = validateAndExtractHSL(brandTheme.colors.primary, '174, 62%, 38%');
    const secondary = validateAndExtractHSL(brandTheme.colors.secondary, '142, 76%, 45%');
    const accent = validateAndExtractHSL(brandTheme.colors.accent, '280, 70%, 60%');
    const background = validateAndExtractHSL(brandTheme.colors.background, '0, 0%, 100%');
    const card = validateAndExtractHSL(brandTheme.colors.card, '0, 0%, 98%');
    const heroGradient = validateGradient(brandTheme.gradients.hero, 'linear-gradient(135deg, hsl(174, 62%, 38%), hsl(142, 76%, 45%))');
    const featureGradient = validateGradient(brandTheme.gradients.feature, 'linear-gradient(to right, hsl(174, 62%, 48%), hsl(142, 76%, 55%))');

    // Calculate brightness of background to determine foreground color
    // HSL format: "hue, saturation%, lightness%"
    const getLightness = (hslStr: string): number => {
      const parts = hslStr.split(',');
      if (parts.length >= 3) {
        const lightnessPart = parts[2].trim();
        return parseFloat(lightnessPart); // Should handle "lightness%"
      }
      return 50; // Default to middle
    };

    const bgLightness = getLightness(background);
    const isDarkBg = bgLightness < 50;
    const primaryLightness = getLightness(primary);
    const isDarkPrimary = primaryLightness < 60; // Primary needs to be quite dark to have white text

    const fallbackForeground = '160, 10%, 15%'; // Always dark for light backgrounds
    const fallbackMutedForeground = '160, 10%, 40%';
    const fallbackCardForeground = '160, 10%, 15%';
    const fallbackPrimaryForeground = isDarkPrimary ? '0, 0%, 100%' : '160, 10%, 15%';

    const foreground = brandTheme.colors.foreground
      ? validateAndExtractHSL(brandTheme.colors.foreground, fallbackForeground)
      : fallbackForeground;
    const mutedForeground = fallbackMutedForeground; // Keep fallback for muted for now
    const cardForeground = brandTheme.colors.cardForeground
      ? validateAndExtractHSL(brandTheme.colors.cardForeground, fallbackCardForeground)
      : fallbackCardForeground;
    const heroForeground = brandTheme.colors.heroForeground
      ? validateAndExtractHSL(brandTheme.colors.heroForeground, '0, 0%, 100%') // Fallback to white
      : '0, 0%, 100%';
    const primaryForeground = brandTheme.colors.primaryForeground
      ? validateAndExtractHSL(brandTheme.colors.primaryForeground, fallbackPrimaryForeground)
      : fallbackPrimaryForeground;

    const themeStyles: React.CSSProperties = {
      '--brand-primary': primary,
      '--brand-secondary': secondary,
      '--brand-accent': accent,
      '--brand-background': background,
      '--brand-card': card,
      '--brand-foreground': foreground,
      '--brand-muted-foreground': mutedForeground,
      '--brand-card-foreground': cardForeground,
      '--brand-primary-foreground': primaryForeground,
      '--brand-hero-foreground': heroForeground,
      '--brand-gradient-hero': heroGradient,
      '--brand-gradient-feature': featureGradient,
    } as React.CSSProperties;

    setThemeStyles(themeStyles);
    setTheme(brandTheme);
  };

  const [themeStyles, setThemeStyles] = useState<React.CSSProperties>({});

  useEffect(() => {
    fetchTheme();
  }, [brandId]);

  return (
    <BrandThemeContext.Provider value={{ theme, loading, refreshTheme: fetchTheme }}>
      <div
        className={theme ? 'brand-themed' : ''}
        // Ensure the wrapper covers the full height if themed, to apply background
        style={theme ? { ...themeStyles, minHeight: '100vh', display: 'flex', flexDirection: 'column' } : {}}
      >
        {children}
      </div>
    </BrandThemeContext.Provider>
  );
}

export function useBrandTheme() {
  return useContext(BrandThemeContext);
}
