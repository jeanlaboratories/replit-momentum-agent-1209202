import { 
  Lightbulb, 
  TrendingUp, 
  Globe, 
  Palette, 
  Calendar, 
  FileText, 
  Music, 
  Search, 
  Brain, 
  Wand2, 
  Link, 
  Database, 
  FolderSearch, 
  Images, 
  MessageSquare 
} from 'lucide-react';
import { ModeCategory, ModeInfo, UnifiedMode, IconComponent } from '@/types/chat';

export const examplePrompts: Record<ModeCategory, string[]> = {
  'agent': [
    "Help me brainstorm ideas for our next team meeting",
    "Generate an image for our team presentation",
    "Create a 7-day sprint event starting next Monday",
    "Suggest creative domain names for our team",
    "Design logo concepts for our sports team",
    "Plan a website for our community organization",
  ],
  'ai-models': [
    "Help me brainstorm ideas for our next team meeting",
    "Generate an image for our team presentation",
    "Create a 5-second video intro for our project",
    "Analyze this image and suggest improvements",
    "Edit this image to add a sunset background",
  ],
  'team-tools': [
    "What's the best way to organize our research findings?",
    "Create a 7-day sprint event starting next Monday",
    "Build a 2-week recruitment event with 3 posts per day",
    "30-day volunteer awareness event with social posts",
    "tech team, innovation, collaboration",
    "Help me plan a website for our community organization",
    "Create a strategic plan for our product team",
    "Design logo concepts for our sports team",
  ],
};

export const allModesInfo: Record<UnifiedMode, ModeInfo> = {
  'agent': {
    name: 'Team Companion',
    description: 'Your AI companion for comprehensive team support with access to all tools and capabilities.',
    icon: Brain as IconComponent,
  },
  'gemini-text': {
    name: 'Text Assistant',
    description: 'Pure text conversations for writing, analysis, and general questions.',
    icon: MessageSquare as IconComponent,
  },
  'imagen': {
    name: 'Image Generator',
    description: 'Create stunning images from text descriptions.',
    icon: Images as IconComponent,
  },
  'gemini-vision': {
    name: 'Vision Analyst',
    description: 'Analyze and understand images with detailed insights.',
    icon: FolderSearch as IconComponent,
  },
  'veo': {
    name: 'Video Creator',
    description: 'Generate engaging videos from text prompts.',
    icon: Database as IconComponent,
  },
  'nano-banana': {
    name: 'Text Editor',
    description: 'Advanced text editing and refinement.',
    icon: Wand2 as IconComponent,
  },
  'team-chat': {
    name: 'Team Assistant',
    description: 'Collaborative conversations optimized for team discussions.',
    icon: MessageSquare as IconComponent,
  },
  'domain-suggestions': {
    name: 'Domain Ideas',
    description: 'Generate creative domain name suggestions for your projects.',
    icon: Link as IconComponent,
  },
  'website-planning': {
    name: 'Website Planner',
    description: 'Plan and structure your website projects.',
    icon: Globe as IconComponent,
  },
  'team-strategy': {
    name: 'Strategy Builder',
    description: 'Develop strategic plans and roadmaps for your team.',
    icon: TrendingUp as IconComponent,
  },
  'logo-concepts': {
    name: 'Logo Designer',
    description: 'Create unique logo concepts and brand identity ideas.',
    icon: Palette as IconComponent,
  },
  'event-creator': {
    name: 'Event Planner',
    description: 'Plan and organize events, campaigns, and timelines.',
    icon: Calendar as IconComponent,
  },
  'search': {
    name: 'Web Search',
    description: 'Search the web for current information and insights.',
    icon: Search as IconComponent,
  },
  'youtube-analysis': {
    name: 'YouTube Analyzer',
    description: 'Analyze YouTube videos for insights and summaries.',
    icon: FileText as IconComponent,
  },
  'youtube-search': {
    name: 'YouTube Search',
    description: 'Find relevant YouTube videos for your projects.',
    icon: Search as IconComponent,
  },
  'crawl-website': {
    name: 'Website Crawler',
    description: 'Extract and analyze content from websites.',
    icon: Globe as IconComponent,
  },
  'memory': {
    name: 'Memory Bank',
    description: 'Access and search your team\'s conversation history.',
    icon: Brain as IconComponent,
  },
  'rag-search': {
    name: 'Knowledge Search',
    description: 'Search through your team\'s knowledge base.',
    icon: Database as IconComponent,
  },
  'media-search': {
    name: 'Media Search',
    description: 'Find images, videos, and media in your library.',
    icon: Images as IconComponent,
  },
  'media-index': {
    name: 'Media Indexer',
    description: 'Index and organize your media library.',
    icon: FolderSearch as IconComponent,
  },
};

export const teamToolModes = [
  'team-chat',
  'domain-suggestions', 
  'website-planning',
  'team-strategy',
  'logo-concepts',
  'event-creator',
  'search',
  'youtube-analysis',
  'youtube-search',
  'crawl-website',
  'memory',
  'rag-search',
  'media-search',
  'media-index'
] as const;