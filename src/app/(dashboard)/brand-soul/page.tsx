'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Globe, Upload, Brain, Sparkles } from 'lucide-react';
import { PageTransition } from '@/components/ui/page-transition';
import UploadSourcesTab from '@/components/brand-soul/UploadSourcesTab';
import ArtifactsTab from '@/components/brand-soul/ArtifactsTab';
import InsightsTab from '@/components/brand-soul/InsightsTab';
import BrandSoulTab from '@/components/brand-soul/BrandSoulTab';

export default function BrandSoulPage() {
  const [activeTab, setActiveTab] = useState('upload');

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
            <Brain className="w-10 h-10 text-purple-600" />
            Team Intelligence Seeding
          </h1>
          <p className="text-gray-600 text-lg">
            Build your AI-powered team knowledge base by uploading documents, crawling websites, and adding team guidelines.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Sources
            </TabsTrigger>
            <TabsTrigger value="artifacts" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Artifacts
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="brand-soul" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Team Intelligence
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-0">
            <UploadSourcesTab />
          </TabsContent>

          <TabsContent value="artifacts" className="mt-0">
            <ArtifactsTab />
          </TabsContent>

          <TabsContent value="insights" className="mt-0">
            <InsightsTab />
          </TabsContent>

          <TabsContent value="brand-soul" className="mt-0">
            <BrandSoulTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
