# Default AI Model Settings
# These values should match the defaults in src/app/actions/ai-settings.ts
# All code using hardcoded models should import and use these defaults

DEFAULT_TEXT_MODEL = 'gemini-2.0-flash'
DEFAULT_AGENT_MODEL = 'gemini-2.0-flash'
DEFAULT_IMAGE_MODEL = 'imagen-4.0-generate-001'
DEFAULT_IMAGE_EDIT_MODEL = 'gemini-3-pro-image-preview'
DEFAULT_VIDEO_MODEL = 'veo-3.1-generate-preview'
DEFAULT_YOUTUBE_ANALYSIS_MODEL = 'gemini-2.5-flash'
DEFAULT_SEARCH_MODEL = 'gemini-2.0-flash'

# Full default settings dict matching AIModelSettings interface
DEFAULT_SETTINGS = {
    'textModel': DEFAULT_TEXT_MODEL,
    'agentModel': DEFAULT_AGENT_MODEL,
    'teamChatModel': DEFAULT_TEXT_MODEL,
    'eventCreatorModel': DEFAULT_TEXT_MODEL,
    'domainSuggestionsModel': DEFAULT_TEXT_MODEL,
    'websitePlanningModel': DEFAULT_TEXT_MODEL,
    'teamStrategyModel': DEFAULT_TEXT_MODEL,
    'logoConceptsModel': DEFAULT_TEXT_MODEL,
    'searchModel': DEFAULT_SEARCH_MODEL,
    'youtubeAnalysisModel': DEFAULT_YOUTUBE_ANALYSIS_MODEL,
    'imageModel': DEFAULT_IMAGE_MODEL,
    'imageEditModel': DEFAULT_IMAGE_EDIT_MODEL,
    'videoModel': DEFAULT_VIDEO_MODEL,
}

# Available model choices for reference
AVAILABLE_TEXT_MODELS = [
    'gemini-3-pro-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-thinking-001',
]

AVAILABLE_IMAGE_MODELS = [
    'imagen-4.0-generate-001',
    'imagen-4.0-ultra-generate-001',
    'imagen-4.0-fast-generate-001',
    'imagen-3.0-generate-002',
    'imagen-3.0-generate-001',
    'imagen-3.0-capability-001',
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image',
]

AVAILABLE_VIDEO_MODELS = [
    'veo-3.1-generate-preview',
    'veo-3.1-fast-generate-preview',
    'veo-3.0-fast-generate-001',
    'veo-2.0-generate-001',
]
