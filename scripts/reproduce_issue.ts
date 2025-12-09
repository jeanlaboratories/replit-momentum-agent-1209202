
import { CampaignTimeline } from './src/lib/types';

const simulateCampaignData = (): CampaignTimeline => {
    return [
        {
            id: 'day-1',
            day: 1,
            date: new Date().toISOString(),
            contentBlocks: [
                {
                    id: 'block-1',
                    contentType: 'Social Media Post',
                    keyMessage: 'Day 1 Post',
                    toneOfVoice: 'Professional',
                    // No imageUrl or assetUrl
                }
            ]
        },
        {
            id: 'day-2',
            day: 2,
            date: new Date(Date.now() + 86400000).toISOString(),
            contentBlocks: [
                {
                    id: 'block-2',
                    contentType: 'Social Media Post',
                    keyMessage: 'Day 2 Post',
                    toneOfVoice: 'Professional',
                    imageUrl: 'https://via.placeholder.com/150',
                    assetUrl: 'https://via.placeholder.com/150'
                }
            ]
        }
    ];
};

console.log(JSON.stringify(simulateCampaignData(), null, 2));
