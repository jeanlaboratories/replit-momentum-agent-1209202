'use client';

import { useState, useEffect } from 'react';
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { PageTransition } from '@/components/ui/page-transition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, Globe, Monitor, TrendingUp, Palette, AlertCircle, CheckCircle } from 'lucide-react';

interface AgentResponse {
  success: boolean;
  result: string;
  agent_type: string;
  error?: string;
  metadata?: Record<string, any>;
}

interface AgentInfo {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  agents: string[];
}

interface AgentStatus {
  api_key_configured: boolean;
  agent_available: boolean;
  status: string;
  message: string;
}

export default function MarketingAgentTest() {
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatResponse, setChatResponse] = useState<AgentResponse | null>(null);
  const [keywords, setKeywords] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [domainResponse, setDomainResponse] = useState<AgentResponse | null>(null);
  const [businessInfo, setBusinessInfo] = useState({
    name: '',
    type: '',
    industry: '',
    target_audience: '',
    goals: '',
    services: '',
    budget: '',
    timeline: '',
    style: '',
    colors: '',
    values: ''
  });
  const [selectedDomain, setSelectedDomain] = useState('');
  const [websiteResponse, setWebsiteResponse] = useState<AgentResponse | null>(null);
  const [marketingResponse, setMarketingResponse] = useState<AgentResponse | null>(null);
  const [logoResponse, setLogoResponse] = useState<AgentResponse | null>(null);
  
  const { toast } = useToast();

  // Check agent status on load
  useEffect(() => {
    checkAgentStatus();
  }, []);

  const checkAgentStatus = async () => {
    try {
      const response = await fetch('/api/python/marketing-agent/status');
      if (response.ok) {
        const status = await response.json();
        setAgentStatus(status);
        
        if (status.agent_available) {
          // Get agent info if available
          const infoResponse = await fetch('/api/python/marketing-agent/info');
          if (infoResponse.ok) {
            const info = await infoResponse.json();
            setAgentInfo(info);
          }
        }
      }
    } catch (error) {
      console.error('Error checking agent status:', error);
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Could not connect to the marketing agent service.'
      });
    }
  };

  const handleChat = async () => {
    if (!chatMessage.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/python/marketing-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatMessage, context: null })
      });

      if (response.ok) {
        const result = await response.json();
        setChatResponse(result);
        toast({
          title: 'Chat Response',
          description: 'Marketing agent responded successfully!'
        });
      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get response');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Chat Error',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDomainSuggestions = async () => {
    if (!keywords.trim()) return;
    
    setLoading(true);
    try {
      const keywordArray = keywords.split(',').map(k => k.trim()).filter(k => k);
      const response = await fetch('/api/python/marketing-agent/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          keywords: keywordArray, 
          business_type: businessType.trim() || null 
        })
      });

      if (response.ok) {
        const result = await response.json();
        setDomainResponse(result);
        toast({
          title: 'Domain Suggestions',
          description: 'Generated domain suggestions successfully!'
        });
      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get domain suggestions');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Domain Error',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWebsitePlan = async () => {
    if (!selectedDomain.trim() || !businessInfo.name.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/python/marketing-agent/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domain: selectedDomain,
          business_info: businessInfo
        })
      });

      if (response.ok) {
        const result = await response.json();
        setWebsiteResponse(result);
        toast({
          title: 'Website Plan',
          description: 'Generated website plan successfully!'
        });
      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create website plan');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Website Error',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarketingStrategy = async () => {
    if (!businessInfo.name.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/python/marketing-agent/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_info: businessInfo })
      });

      if (response.ok) {
        const result = await response.json();
        setMarketingResponse(result);
        toast({
          title: 'Marketing Strategy',
          description: 'Generated marketing strategy successfully!'
        });
      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create marketing strategy');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Marketing Error',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoConcepts = async () => {
    if (!businessInfo.name.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/python/marketing-agent/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_info: businessInfo })
      });

      if (response.ok) {
        const result = await response.json();
        setLogoResponse(result);
        toast({
          title: 'Logo Concepts',
          description: 'Generated logo concepts successfully!'
        });
      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create logo concepts');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Logo Error',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const ResponseDisplay = ({ response }: { response: AgentResponse | null }) => {
    if (!response) return null;

    return (
      <GlassCard className="mt-4">
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            {response.success ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
            Response from {response.agent_type} Agent
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          {response.success ? (
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm">{response.result}</pre>
            </div>
          ) : (
            <div className="text-red-600">
              <p>Error: {response.error}</p>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    );
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Google ADK Marketing Agent Test</h1>
        <p className="text-muted-foreground">
          Test the integrated Google ADK Marketing Agency functionality
        </p>
      </div>

      {/* Agent Status Card */}
        <GlassCard className="mb-6">
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Agent Status
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
          {agentStatus ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={agentStatus.agent_available ? 'default' : 'destructive'}>
                  {agentStatus.status}
                </Badge>
                <span className="text-sm">{agentStatus.message}</span>
              </div>
              
              {agentInfo && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold">{agentInfo.name} v{agentInfo.version}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{agentInfo.description}</p>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Capabilities:</p>
                    <div className="flex flex-wrap gap-1">
                      {agentInfo.capabilities.map((cap, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking agent status...</span>
            </div>
          )}
          </GlassCardContent>
        </GlassCard>

      {agentStatus?.agent_available ? (
        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="chat" className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="domains" className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              Domains
            </TabsTrigger>
            <TabsTrigger value="website" className="flex items-center gap-1">
              <Monitor className="h-4 w-4" />
              Website
            </TabsTrigger>
            <TabsTrigger value="marketing" className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Marketing
            </TabsTrigger>
            <TabsTrigger value="logo" className="flex items-center gap-1">
              <Palette className="h-4 w-4" />
              Logo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
              <GlassCard>
                <GlassCardHeader>
                  <GlassCardTitle>Chat with Marketing Coordinator</GlassCardTitle>
                  <GlassCardDescription>
                  Have a conversation with the marketing agent coordinator
                  </GlassCardDescription>
                </GlassCardHeader>
                <GlassCardContent className="space-y-4">
                <div>
                  <Label htmlFor="chat-message">Your Message</Label>
                  <Textarea
                    id="chat-message"
                    placeholder="Ask about marketing strategies, business advice, or any questions..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button 
                  onClick={handleChat} 
                  disabled={loading || !chatMessage.trim()}
                  className="w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Send Message
                </Button>
                <ResponseDisplay response={chatResponse} />
                </GlassCardContent>
              </GlassCard>
          </TabsContent>

          <TabsContent value="domains">
              <GlassCard>
                <GlassCardHeader>
                  <GlassCardTitle>Domain Name Suggestions</GlassCardTitle>
                  <GlassCardDescription>
                  Get AI-generated domain name suggestions based on your keywords
                  </GlassCardDescription>
                </GlassCardHeader>
                <GlassCardContent className="space-y-4">
                <div>
                  <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                  <Input
                    id="keywords"
                    placeholder="organic, bakery, fresh, local"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="business-type">Business Type (optional)</Label>
                  <Input
                    id="business-type"
                    placeholder="e.g., Food & Beverage, Technology, Healthcare"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleDomainSuggestions} 
                  disabled={loading || !keywords.trim()}
                  className="w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Generate Domain Suggestions
                </Button>
                <ResponseDisplay response={domainResponse} />
                </GlassCardContent>
              </GlassCard>
          </TabsContent>

          <TabsContent value="website">
              <GlassCard>
                <GlassCardHeader>
                  <GlassCardTitle>Website Planning</GlassCardTitle>
                  <GlassCardDescription>
                  Create a comprehensive website plan for your business
                  </GlassCardDescription>
                </GlassCardHeader>
                <GlassCardContent className="space-y-4">
                <div>
                  <Label htmlFor="selected-domain">Domain Name</Label>
                  <Input
                    id="selected-domain"
                    placeholder="example.com"
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="business-name">Business Name</Label>
                    <Input
                      id="business-name"
                      placeholder="Your Business Name"
                      value={businessInfo.name}
                      onChange={(e) => setBusinessInfo({...businessInfo, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="business-type-info">Business Type</Label>
                    <Input
                      id="business-type-info"
                      placeholder="e.g., E-commerce, Service, SaaS"
                      value={businessInfo.type}
                      onChange={(e) => setBusinessInfo({...businessInfo, type: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="target-audience">Target Audience</Label>
                  <Input
                    id="target-audience"
                    placeholder="e.g., Young professionals, Families, Tech enthusiasts"
                    value={businessInfo.target_audience}
                    onChange={(e) => setBusinessInfo({...businessInfo, target_audience: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="goals">Primary Goals</Label>
                  <Textarea
                    id="goals"
                    placeholder="What do you want to achieve with your website?"
                    value={businessInfo.goals}
                    onChange={(e) => setBusinessInfo({...businessInfo, goals: e.target.value})}
                    rows={2}
                  />
                </div>
                <Button 
                  onClick={handleWebsitePlan} 
                  disabled={loading || !selectedDomain.trim() || !businessInfo.name.trim()}
                  className="w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Website Plan
                </Button>
                <ResponseDisplay response={websiteResponse} />
                </GlassCardContent>
              </GlassCard>
          </TabsContent>

          <TabsContent value="marketing">
              <GlassCard>
                <GlassCardHeader>
                  <GlassCardTitle>Marketing Strategy</GlassCardTitle>
                  <GlassCardDescription>
                  Generate a comprehensive marketing strategy for your business
                  </GlassCardDescription>
                </GlassCardHeader>
                <GlassCardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      placeholder="e.g., Technology, Healthcare, Retail"
                      value={businessInfo.industry}
                      onChange={(e) => setBusinessInfo({...businessInfo, industry: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="budget">Marketing Budget</Label>
                    <Input
                      id="budget"
                      placeholder="e.g., $1,000-5,000/month"
                      value={businessInfo.budget}
                      onChange={(e) => setBusinessInfo({...businessInfo, budget: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="timeline">Timeline</Label>
                  <Input
                    id="timeline"
                    placeholder="e.g., 3 months, 6 months, 1 year"
                    value={businessInfo.timeline}
                    onChange={(e) => setBusinessInfo({...businessInfo, timeline: e.target.value})}
                  />
                </div>
                <Button 
                  onClick={handleMarketingStrategy} 
                  disabled={loading || !businessInfo.name.trim()}
                  className="w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Marketing Strategy
                </Button>
                <ResponseDisplay response={marketingResponse} />
                </GlassCardContent>
              </GlassCard>
          </TabsContent>

          <TabsContent value="logo">
              <GlassCard>
                <GlassCardHeader>
                  <GlassCardTitle>Logo Design Concepts</GlassCardTitle>
                  <GlassCardDescription>
                  Generate creative logo design concepts for your team
                  </GlassCardDescription>
                </GlassCardHeader>
                <GlassCardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="style">Style Preference</Label>
                    <Input
                      id="style"
                      placeholder="e.g., Modern, Minimalist, Vintage, Bold"
                      value={businessInfo.style}
                      onChange={(e) => setBusinessInfo({...businessInfo, style: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="colors">Color Preferences</Label>
                    <Input
                      id="colors"
                      placeholder="e.g., Blue and white, Earth tones, Bright colors"
                      value={businessInfo.colors}
                      onChange={(e) => setBusinessInfo({...businessInfo, colors: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="values">Team Values/Personality</Label>
                  <Textarea
                    id="values"
                    placeholder="Describe your team's personality and values..."
                    value={businessInfo.values}
                    onChange={(e) => setBusinessInfo({...businessInfo, values: e.target.value})}
                    rows={2}
                  />
                </div>
                <Button 
                  onClick={handleLogoConcepts} 
                  disabled={loading || !businessInfo.name.trim()}
                  className="w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Generate Logo Concepts
                </Button>
                <ResponseDisplay response={logoResponse} />
                </GlassCardContent>
              </GlassCard>
          </TabsContent>
        </Tabs>
      ) : (
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Setup Required
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent>
            <div className="space-y-4">
              <p>
                The Marketing Agent requires a Google API key to function. 
                Please configure the GOOGLE_API_KEY environment variable to use this feature.
              </p>
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Setup Instructions:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Get a Google API key from the Google Cloud Console</li>
                  <li>Add it as GOOGLE_API_KEY in your environment variables</li>
                  <li>Restart the Python service</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
              <Button onClick={checkAgentStatus} variant="outline">
                Check Status Again
              </Button>
            </div>
              </GlassCardContent>
            </GlassCard>
      )}
      </div>
    </PageTransition>
  );
}
