# MOMENTUM - AI Team Intelligence Platform

## Overview

MOMENTUM is an AI-powered team intelligence and execution platform built with Next.js 15 and Python FastAPI. It creates a living "Team Intelligence" knowledge base from diverse sources (websites, documents, videos, images) that influences all AI-generated content. The platform supports multimodal AI generation using Google Gemini, Imagen 4.0, and Veo 3.1.

**Core Purpose**: Transform scattered team knowledge into actionable intelligence that powers planning, content creation, and execution for any type of team (sports, product, creative, research, volunteer, marketing).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Next.js 15)
- **Framework**: Next.js 15 with App Router
- **UI**: React components with Tailwind CSS
- **State Management**: React Context for global state (GlobalChatbotContext for chat state persistence across mode switches)
- **Real-time**: Streaming responses for AI chat

### Backend Services
- **Next.js API Routes**: Handle authentication, chat, media operations
- **Python FastAPI Service**: Hosts the AI agent (Google ADK), runs on port 8000 internally
- **Dual Service Architecture**: Next.js serves on port 5000, proxies AI requests to Python service

### AI Agent System
- **Google ADK (Agent Development Kit)**: Python-based agentic AI assistant
- **Tools Available**: 21 tools including `generate_text`, `generate_image`, `analyze_image`, `generate_video`, `nano_banana` (image editing), media search tools
- **Multimodal Vision**: Images uploaded are converted to multimodal parts for native Gemini vision understanding
- **Context Injection**: Team Intelligence, Brand Soul, and user profiles injected into every request

### Media Handling
- **Unified Media Library**: Consolidates AI-generated, uploaded, and extracted media
- **Media Reference Resolution**: Robust system handling re-injected media, historical references, and disambiguation
- **Vision Analysis**: Automatic image analysis with searchable metadata
- **Display Markers**: `__IMAGE_URL__` and `__VIDEO_URL__` markers for rich previews

### Caching Strategy
- **AI Context Cache**: 5-minute TTL for team context
- **Team Intelligence Cache**: 10-minute TTL
- **Brand Soul Cache**: 10-minute TTL with parameter-aware keys

## External Dependencies

### Google Cloud Services
- **Firebase Auth**: User authentication
- **Firestore**: Primary database for all data storage
- **Firebase Storage**: Media file storage
- **Vertex AI**: Imagen 4.0 (images), Veo 3.1 (videos)
- **Google Gemini**: Text generation and multimodal understanding
- **Vertex AI Agent Engine**: Memory Bank for persistent agent memory (optional, enabled via `MOMENTUM_ENABLE_MEMORY_BANK=true`)
- **Discovery Engine**: Vertex AI Search for media semantic search

### Third-Party APIs
- **Firecrawl**: Website crawling for Team Intelligence ingestion

### Environment Variables (MOMENTUM_ prefix)
- `MOMENTUM_GOOGLE_API_KEY`: Google AI API key
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_*`: Firebase client configuration
- `MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON`: Firebase admin credentials
- `MOMENTUM_FIRECRAWL_API_KEY`: Firecrawl API key
- `MOMENTUM_ENABLE_MEMORY_BANK`: Enable Vertex AI Memory Bank feature
- `MOMENTUM_AGENT_ENGINE_LOCATION`: Region for Agent Engine (default: us-central1)

### Deployment
- **Target**: Google Cloud Run or Replit Reserved VM
- **Build**: `npm run build`
- **Start**: `bash start-services.sh` (starts both Next.js and Python services)
- **Ports**: Next.js on 5000 (external), Python on 8000 (internal)