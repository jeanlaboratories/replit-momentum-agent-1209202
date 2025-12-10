'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle, Clock, ExternalLink, TrendingUp } from 'lucide-react';
import { StructuredData, CampaignData, CampaignDay, ContentBlock } from '@/types/chat';

export const renderStructuredData = (data: StructuredData) => {
  if (!data?.data) return null;
  
  // Check for character consistency data
  const characterConsistency = (data as any).characterConsistency;
  if (characterConsistency) {
    return (
      <Card className="p-4 my-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-lg">Character Consistency Analysis</h3>
        </div>
        
        {characterConsistency.overallConsistency && (
          <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border">
            <h4 className="font-medium text-purple-700 dark:text-purple-300 mb-2">Overall Consistency</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">{characterConsistency.overallConsistency}</p>
          </div>
        )}
        
        {characterConsistency.characterAnalysis && characterConsistency.characterAnalysis.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-purple-700 dark:text-purple-300">Character Analysis</h4>
            {characterConsistency.characterAnalysis.map((char: any, index: number) => (
              <div key={index} className="p-3 bg-white dark:bg-gray-800 rounded-lg border">
                <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-1">{char.name}</h5>
                {char.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{char.description}</p>
                )}
                {char.consistency && (
                  <p className="text-sm text-purple-600 dark:text-purple-400">{char.consistency}</p>
                )}
              </div>
            ))}
          </div>
        )}
        
        {characterConsistency.recommendations && characterConsistency.recommendations.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium text-purple-700 dark:text-purple-300 mb-2">Recommendations</h4>
            <ul className="space-y-1">
              {characterConsistency.recommendations.map((rec: string, index: number) => (
                <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    );
  }
  
  // Campaign data rendering
  const isCampaignData = (data: any): data is StructuredData & CampaignData => {
    return data?.data?.campaignDays && Array.isArray(data.data.campaignDays);
  };
  
  if (isCampaignData(data)) {
    return (
      <Card className="p-4 my-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-lg">Campaign Plan: {data.data?.campaignName}</h3>
        </div>
        
        <div className="space-y-4">
          {data.data?.campaignDays?.map((day: CampaignDay, dayIndex: number) => (
            <div key={dayIndex} className="border-l-4 border-blue-300 pl-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  Day {day.day} - {new Date(day.date).toLocaleDateString()}
                </span>
              </div>
              
              <div className="space-y-2">
                {day.contentBlocks?.map((block: ContentBlock, blockIndex: number) => (
                  <div key={blockIndex} className="bg-white dark:bg-gray-800 p-3 rounded-lg border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                        {block.contentType}
                      </span>
                      {block.scheduledTime && (
                        <span className="text-xs text-gray-500">{block.scheduledTime}</span>
                      )}
                    </div>
                    
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      {block.keyMessage}
                    </h4>
                    
                    {block.adCopy && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {block.adCopy}
                      </p>
                    )}
                    
                    {block.imagePrompt && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                        <strong>Image prompt:</strong> {block.imagePrompt}
                      </div>
                    )}
                    
                    {block.imageUrl && (
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(block.imageUrl, '_blank')}
                          className="text-xs"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View Image
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }
  
  return null;
};