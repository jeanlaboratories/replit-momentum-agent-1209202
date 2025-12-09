import { NextRequest, NextResponse } from 'next/server';
import { parseCampaignRequest, calculatePostSchedule } from '@/lib/campaign-creation-agent';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, brandId, scheduledTimes, toneOfVoice } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!brandId) {
      return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 });
    }

    const eventRequest = await parseCampaignRequest(prompt);

    // Override scheduledTimes if provided by the caller (from Python create_event tool)
    if (scheduledTimes && Array.isArray(scheduledTimes) && scheduledTimes.length > 0) {
      eventRequest.scheduledTimes = scheduledTimes;
    }

    // Override tones if toneOfVoice is provided by the caller
    if (toneOfVoice && typeof toneOfVoice === 'string') {
      // Map the tone string to the valid tone values
      const validTones = ['Professional', 'Playful', 'Urgent'] as const;
      const normalizedTone = toneOfVoice.charAt(0).toUpperCase() + toneOfVoice.slice(1).toLowerCase();
      if (validTones.includes(normalizedTone as typeof validTones[number])) {
        eventRequest.tones = [normalizedTone as typeof validTones[number]];
      }
    }

    // Parse ISO date string as local date to avoid timezone conversion issues
    const [year, month, day] = eventRequest.startDate.split('-').map(Number);
    const startDate = new Date(year, month - 1, day); // month is 0-indexed
    const dateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const uniqueEventName = `${eventRequest.campaignName} - ${dateStr}`;

    const postSchedule = calculatePostSchedule(
      eventRequest.duration,
      eventRequest.postsPerDay,
      eventRequest.postDistribution
    );
    const totalPosts = postSchedule.reduce((a, b) => a + b, 0);

    return NextResponse.json({
      campaignName: uniqueEventName,
      campaignRequest: eventRequest,
      totalPosts,
      startDate: eventRequest.startDate,
      duration: eventRequest.duration,
      postsPerDay: eventRequest.postsPerDay,
    });
  } catch (error) {
    console.error('Error parsing event description:', error);
    return NextResponse.json(
      { error: `Failed to parse event: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
