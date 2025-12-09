'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Sparkles, Image as ImageIcon, Plus, X, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface CharacterReference {
  id: string;
  name: string;
  characterSheetUrl: string;
  isActive: boolean;
}

interface TestResult {
  status: 'success' | 'error';
  imageUrl?: string;
  message?: string;
  error?: string;
}

export default function CharacterConsistencyTestPage() {
  const { brandId } = useAuth();
  const { toast } = useToast();

  // Character consistency state
  const [characters, setCharacters] = useState<CharacterReference[]>([]);
  const [newCharacterUrl, setNewCharacterUrl] = useState('');
  const [newCharacterName, setNewCharacterName] = useState('');
  const [useSceneToSceneConsistency, setUseSceneToSceneConsistency] = useState(true);

  // Test state
  const [prompt, setPrompt] = useState('A friendly cartoon character waving hello in a sunny park');
  const [isGenerating, setIsGenerating] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [previousSceneUrl, setPreviousSceneUrl] = useState<string | undefined>();

  // Add character
  const addCharacter = () => {
    if (!newCharacterUrl.trim()) {
      toast({ title: 'Error', description: 'Please enter a character sheet URL', variant: 'destructive' });
      return;
    }

    const newChar: CharacterReference = {
      id: `char-${Date.now()}`,
      name: newCharacterName.trim() || `Character ${characters.length + 1}`,
      characterSheetUrl: newCharacterUrl.trim(),
      isActive: true,
    };

    setCharacters([...characters, newChar]);
    setNewCharacterUrl('');
    setNewCharacterName('');
    toast({ title: 'Character Added', description: `Added ${newChar.name}` });
  };

  // Remove character
  const removeCharacter = (id: string) => {
    setCharacters(characters.filter(c => c.id !== id));
  };

  // Toggle character active state
  const toggleCharacter = (id: string) => {
    setCharacters(characters.map(c =>
      c.id === id ? { ...c, isActive: !c.isActive } : c
    ));
  };

  // Generate image with character consistency
  const generateImage = async () => {
    if (!brandId) {
      toast({ title: 'Error', description: 'Please sign in first', variant: 'destructive' });
      return;
    }

    const activeCharacters = characters.filter(c => c.isActive);
    if (activeCharacters.length === 0) {
      toast({ title: 'Error', description: 'Please add at least one character sheet', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);

    try {
      // Build reference images - character sheets + previous scene
      const referenceImages = activeCharacters.map(c => c.characterSheetUrl);
      if (useSceneToSceneConsistency && previousSceneUrl) {
        referenceImages.push(previousSceneUrl);
      }

      // Call through Next.js API route to avoid CORS issues
      const response = await fetch('/api/media/nano-banana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          reference_images: referenceImages.join(','),
          aspect_ratio: '1:1',
          person_generation: 'allow_all',
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      if (result.status === 'error') {
        throw new Error(result.error || 'Unknown error');
      }

      const imageUrl = result.imageUrl || result.image_url;

      setTestResults([
        {
          status: 'success',
          imageUrl,
          message: `Generated with ${activeCharacters.length} character(s)${useSceneToSceneConsistency && previousSceneUrl ? ' + previous scene' : ''}`,
        },
        ...testResults,
      ]);

      // Update previous scene URL for next generation
      if (useSceneToSceneConsistency && imageUrl) {
        setPreviousSceneUrl(imageUrl);
      }

      toast({ title: 'Success', description: 'Image generated with character consistency!' });
    } catch (error) {
      console.error('Generation error:', error);
      setTestResults([
        {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        ...testResults,
      ]);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to generate', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate character sheet
  const generateCharacterSheet = async () => {
    if (!brandId) {
      toast({ title: 'Error', description: 'Please sign in first', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);

    try {
      // Call through Next.js API route to avoid CORS issues
      const response = await fetch('/api/media/nano-banana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Character sheet of a friendly cartoon mascot character, showing front view, side view, back view, and 3/4 view, consistent art style, simple background, professional character design reference sheet',
          aspect_ratio: '16:9',
          person_generation: 'allow_all',
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      if (result.status === 'error') {
        throw new Error(result.error || 'Unknown error');
      }

      const imageUrl = result.imageUrl || result.image_url;

      // Add as a new character
      const newChar: CharacterReference = {
        id: `char-${Date.now()}`,
        name: `Generated Character ${characters.length + 1}`,
        characterSheetUrl: imageUrl,
        isActive: true,
      };

      setCharacters([...characters, newChar]);
      toast({ title: 'Character Sheet Generated', description: 'New character sheet has been added!' });
    } catch (error) {
      console.error('Generation error:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to generate', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Clear results
  const clearResults = () => {
    setTestResults([]);
    setPreviousSceneUrl(undefined);
  };

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-primary" />
          Character Consistency Test
        </h1>
        <p className="text-muted-foreground mt-2">
          Test the character consistency feature using Nano Banana (Gemini 2.5 Flash Image).
          Generate images that maintain the same character appearance across multiple scenes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          {/* Character Sheets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Character Sheets
              </CardTitle>
              <CardDescription>
                Add character sheet images (multiple views of the same character) for consistency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add character form */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Character sheet URL"
                    value={newCharacterUrl}
                    onChange={(e) => setNewCharacterUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Name (optional)"
                    value={newCharacterName}
                    onChange={(e) => setNewCharacterName(e.target.value)}
                    className="w-32"
                  />
                  <Button onClick={addCharacter} size="icon" variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  onClick={generateCharacterSheet}
                  variant="outline"
                  className="w-full"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4 mr-2" />
                  )}
                  Generate Character Sheet
                </Button>
              </div>

              {/* Character list */}
              {characters.length > 0 ? (
                <div className="space-y-2">
                  {characters.map((char) => (
                    <div
                      key={char.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        char.isActive ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'
                      }`}
                    >
                      <img
                        src={char.characterSheetUrl}
                        alt={char.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{char.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {char.characterSheetUrl.slice(0, 50)}...
                        </p>
                      </div>
                      <Switch
                        checked={char.isActive}
                        onCheckedChange={() => toggleCharacter(char.id)}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeCharacter(char.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No character sheets added yet. Add a URL or generate one.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Generation Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Generation Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Scene Prompt</Label>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the scene you want to generate..."
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Scene-to-Scene Consistency</Label>
                  <p className="text-xs text-muted-foreground">
                    Use previous image as reference for better consistency
                  </p>
                </div>
                <Switch
                  checked={useSceneToSceneConsistency}
                  onCheckedChange={setUseSceneToSceneConsistency}
                />
              </div>

              {previousSceneUrl && (
                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <p className="text-xs font-medium">Previous Scene:</p>
                  <img
                    src={previousSceneUrl}
                    alt="Previous scene"
                    className="w-full h-32 object-cover rounded"
                  />
                </div>
              )}

              <Button
                onClick={generateImage}
                className="w-full"
                disabled={isGenerating || characters.filter(c => c.isActive).length === 0}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate with Character Consistency
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results Panel */}
        <div>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Generated Images</CardTitle>
                <CardDescription>
                  {testResults.length} image(s) generated
                </CardDescription>
              </div>
              {testResults.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearResults}>
                  Clear All
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {testResults.length > 0 ? (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {testResults.map((result, index) => (
                    <div key={index} className="space-y-2">
                      {result.status === 'success' && result.imageUrl ? (
                        <>
                          <img
                            src={result.imageUrl}
                            alt={`Generated image ${index + 1}`}
                            className="w-full rounded-lg border"
                          />
                          <p className="text-xs text-muted-foreground">
                            {result.message}
                          </p>
                        </>
                      ) : (
                        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                          Error: {result.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Generated images will appear here</p>
                  <p className="text-sm mt-2">
                    Add character sheets and click Generate to test
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Instructions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>How to Test</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ol className="space-y-2">
            <li>
              <strong>Add Character Sheet:</strong> Either paste a URL to an existing character sheet image,
              or click "Generate Character Sheet" to create one automatically.
            </li>
            <li>
              <strong>Write a Scene Prompt:</strong> Describe the scene you want to generate.
              The character from your sheet will be placed in this scene.
            </li>
            <li>
              <strong>Enable Scene-to-Scene Consistency:</strong> Turn this on to use each generated
              image as a reference for the next one, improving consistency over multiple generations.
            </li>
            <li>
              <strong>Generate Multiple Images:</strong> Generate several images in sequence to see
              how the character stays consistent across different scenes.
            </li>
          </ol>
          <p className="mt-4 text-muted-foreground">
            <strong>Tip:</strong> For best results, use character sheet images that show the character
            from multiple angles (front, side, back, 3/4 view).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
