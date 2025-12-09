'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardDescription, GlassCardContent } from '@/components/ui/glass-card';
import { PageTransition } from '@/components/ui/page-transition';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { ProcessingJobPOC, ExtractedInsightsPOC } from '@/lib/types/brand-soul-poc';

export default function BrandSoulPOCPage() {
  const [title, setTitle] = useState('About Our Company');
  const [content, setContent] = useState(
    'We are an innovative technology company focused on empowering small businesses with AI-powered marketing tools. Founded in 2020, we believe that every business deserves access to enterprise-grade marketing capabilities. Our mission is to democratize digital marketing through smart, affordable, and easy-to-use solutions. We value transparency, customer success, and continuous innovation. Our team of experts has helped over 500 businesses grow their online presence and achieve their marketing goals.'
  );
  const [brandId, setBrandId] = useState('poc-brand-123');
  
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [artifactId, setArtifactId] = useState<string | null>(null);
  const [job, setJob] = useState<ProcessingJobPOC | null>(null);
  const [insights, setInsights] = useState<ExtractedInsightsPOC | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setJobId(null);
    setJob(null);
    setInsights(null);
    
    try {
      // Submit content for ingestion
      const response = await fetch('/api/brand-soul-poc/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, brandId }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message);
      }
      
      setJobId(data.jobId);
      setArtifactId(data.artifactId);
      
      // Start polling for job status
      pollJobStatus(data.jobId, data.artifactId);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };
  
  const pollJobStatus = async (jId: string, aId: string) => {
    const maxAttempts = 60; // 60 seconds max
    let attempts = 0;
    
    const poll = async () => {
      try {
        // Get job status
        const jobResponse = await fetch(`/api/brand-soul-poc/job/${jId}`);
        const jobData = await jobResponse.json();
        
        setJob(jobData.job);
        
        if (jobData.job.status === 'completed') {
          // Get artifact with insights
          const artifactResponse = await fetch(
            `/api/brand-soul-poc/artifact/${aId}?includeInsights=true`
          );
          const artifactData = await artifactResponse.json();
          
          setInsights(artifactData.insights);
          setLoading(false);
          return;
        }
        
        if (jobData.job.status === 'failed') {
          setError(jobData.job.error || 'Processing failed');
          setLoading(false);
          return;
        }
        
        // Continue polling
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000); // Poll every second
        } else {
          setError('Processing timeout');
          setLoading(false);
        }
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Polling failed');
        setLoading(false);
      }
    };
    
    poll();
  };
  
  const renderStatus = () => {
    if (!job) return null;
    
    const statusIcons = {
      pending: <Clock className="h-5 w-5 text-gray-500" />,
      processing: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
      completed: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      failed: <XCircle className="h-5 w-5 text-red-500" />,
    };
    
    return (
      <GlassCard className="mt-4">
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            {statusIcons[job.status]}
            Processing Status
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="font-semibold">{job.status.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span>Progress:</span>
              <span className="font-semibold">{Math.round(job.progress)}%</span>
            </div>
            {job.currentStep && (
              <div className="flex justify-between">
                <span>Current Step:</span>
                <span className="font-semibold">{job.currentStep}</span>
              </div>
            )}
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.round(job.progress)}%` }}
              />
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  };
  
  const renderInsights = () => {
    if (!insights) return null;
    
    return (
      <GlassCard className="mt-4 border-green-200">
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Extracted Brand Insights
          </GlassCardTitle>
          <GlassCardDescription>
            Confidence Score: {insights.confidence}/100 | Model: {insights.model}
          </GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent className="space-y-6">
          {/* Voice Elements */}
          <div>
            <h3 className="font-semibold text-lg mb-2">Voice Profile</h3>
            <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
              <div><span className="font-medium">Tone:</span> {insights.voiceElements.tone}</div>
              <div><span className="font-medium">Style:</span> {insights.voiceElements.style}</div>
              <div><span className="font-medium">Formality:</span> {insights.voiceElements.formality}/10</div>
              <div>
                <span className="font-medium">Example Sentences:</span>
                <ul className="list-disc list-inside mt-1">
                  {insights.voiceElements.examples.map((ex, i) => (
                    <li key={i} className="italic text-sm">&quot;{ex}&quot;</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          
          {/* Key Facts */}
          <div>
            <h3 className="font-semibold text-lg mb-2">Key Facts ({insights.keyFacts.length})</h3>
            <div className="space-y-2">
              {insights.keyFacts.map((fact, i) => (
                <div key={i} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs uppercase tracking-wide text-gray-500">{fact.category}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {Math.round(fact.confidence)}% confidence
                    </span>
                  </div>
                  <p className="text-sm">{fact.fact}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Core Values */}
          <div>
            <h3 className="font-semibold text-lg mb-2">Core Values</h3>
            <div className="flex flex-wrap gap-2">
              {insights.coreValues.map((value, i) => (
                <span key={i} className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">
                  {value}
                </span>
              ))}
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  };
  
  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Brand Soul Seeding - Proof of Concept</h1>
        <p className="text-gray-600">
          Test the architecture: Manual text input → Storage → Queue → AI Extraction
        </p>
      </div>
      
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>Submit Team Content</GlassCardTitle>
            <GlassCardDescription>
            Enter text about your team to extract insights using AI
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Brand ID</label>
            <Input
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              placeholder="brand-123"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Content Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="About Our Company"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Brand Content (minimum 100 characters)
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="Tell us about your team..."
            />
            <p className="text-xs text-gray-500 mt-1">
              {content.length} characters
            </p>
          </div>
          
          <Button
            onClick={handleSubmit}
            disabled={loading || content.length < 100}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Submit & Extract Insights'
            )}
          </Button>
          </GlassCardContent>
        </GlassCard>
      
      {error && (
        <Alert className="mt-4" variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {renderStatus()}
      {renderInsights()}
      
      {/* Architecture Validation Checklist */}
        <GlassCard className="mt-8 border-blue-200">
          <GlassCardHeader>
            <GlassCardTitle>Architecture Validation Checklist</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Two-tier storage (Firestore metadata + Firebase Storage for content)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Simple job queue system (Firestore-based)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>AI extraction pipeline (Gemini via Genkit)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Real-time status updates (polling)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Complete end-to-end pipeline working</span>
            </div>
          </div>
          </GlassCardContent>
        </GlassCard>
      </div>
    </PageTransition>
  );
}
