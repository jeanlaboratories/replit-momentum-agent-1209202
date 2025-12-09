# MOMENTUM - AI Team Intelligence & Execution Platform

MOMENTUM is a comprehensive AI-powered platform built with Next.js that transforms scattered team knowledge into actionable intelligence. It creates a "Team Intelligence" knowledge base from diverse sources (websites, documents, videos) to guide and power AI-generated content across text, images, and videos. The platform enhances planning, content creation, and execution for any team type, turning collective knowledge into a living playbook to boost productivity and creative output.

> **"AI Team Intelligence that learns your team's playbook and powers every initiative."**

![MOMENTUM Platform](https://storage.googleapis.com/static.aifire.dev/AdVantage-screenshot.png)

## Features

### Core Intelligence
- **Team Intelligence System**: Continuously learns from diverse sources (websites, documents, videos, images) using Firecrawl SDK to create a living knowledge base that influences all AI generation
- **Team Profile Management**: Define your team's core identity, mission, values, key resources, and team roster
- **Individual Identity Profiles**: Personal profiles showcasing individual strengths (70% personal data, 30% team context)
- **Unified Media Library**: Zenfolio-inspired system consolidating all media (AI-generated, Team Intelligence extracts, uploads) with collections, smart filtering, cursor pagination, and virtual scrolling

### AI-Powered Content Generation
- **Multimodal AI Generation**: Leverage Google Gemini, Imagen 4.0, and Veo 3.1 for text, images, and video
- **Context-Aware Creation**: All AI outputs influenced by Team Intelligence to ensure consistency with team voice and style
- **Natural Language Event Creator**: Create multi-day initiatives using natural language descriptions
- **AI Explainability**: Transparency showing how Team Intelligence influenced each generation

### Planning & Execution
- **Event Calendar with Timeline Editor**: Plan multi-day initiatives with intuitive calendar interface and robust timeline editing
- **Timezone Management**: Full timezone-aware date handling with user-selectable timezone preferences
- **Mobile-Responsive Design**: Fully optimized touch-friendly interface for mobile devices
- **Multi-Modal Content Blocks**: Support for text, images, and video content in each event day

### Collaboration & Intelligence
- **Fully Agentic AI Assistant**: Google ADK (Agent Development Kit) Python-powered assistant that knows your team and members intimately
- **Enhanced Context**: Assistant uses Team Intelligence, Individual Identities, team voice, and member skills for personalized assistance
- **@Mention System**: Tag team members in comments with autocomplete
- **Threaded Comments**: Rich collaboration on events, content blocks, and media
- **Role-Based Access Control**: Team Lead and Member roles with appropriate permissions

### Team Management
- **Firebase Authentication**: Self-service signup with email/password authentication
- **Team Roster Management**: Track team members with roles, skills, and achievements
- **User Preferences**: Timezone settings, display preferences, and personalization
- **Audit Trails**: Complete tracking of who created and modified content

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **AI Orchestration**: [Google Genkit](https://firebase.google.com/docs/genkit) with [Google AI models](https://ai.google/)
  - Gemini for text generation
  - Imagen 4.0 for image generation
  - Veo 3.1 for video generation
- **Agentic AI**: [Google ADK Python](https://github.com/google/genkit) for fully agentic assistant
- **Backend**: [Python FastAPI](https://fastapi.tiangolo.com/) service hosting ADK agent
- **Database & Services**: [Firebase](https://firebase.google.com/) (Authentication, Firestore, Cloud Storage)
- **UI**: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [ShadCN UI](https://ui.shadcn.com/)
- **Website Crawling**: [Firecrawl SDK](https://www.firecrawl.dev/) (@mendable/firecrawl-js)
- **Date Handling**: [date-fns](https://date-fns.org/) and [date-fns-tz](https://github.com/marnusw/date-fns-tz)
- **Deployment**: VM (Reserved VM) on Replit supporting both Next.js frontend and Python FastAPI backend

## Prerequisites

Before you begin, ensure you have the following installed and set up:

- **Node.js**: Version 20 or later
- **Python**: Version 3.11 or later (for ADK agent)
- **Google Cloud Project**: A Google Cloud project with billing enabled
- **Firebase Project**: A Firebase project linked to your Google Cloud project
- **Firecrawl API Key**: For website crawling functionality

## 1. Firebase & Google Cloud Setup

This application relies on both Firebase and Google Cloud services for its backend and AI capabilities.

### Enable Required APIs

In your Google Cloud project, make sure the following APIs are enabled:

- **Vertex AI API**: For generative AI models (Gemini, Imagen, Veo)
- **Identity and Access Management (IAM) API**: For managing service accounts

You can enable them via the Google Cloud Console or by using the `gcloud` CLI.

### Create a Service Account

A service account is required for the backend to securely interact with Firebase and Google Cloud services.

1. Navigate to the **IAM & Admin > Service Accounts** page in the Google Cloud Console
2. Click **Create Service Account**
3. Give it a name (e.g., "momentum-backend-service")
4. Grant the following roles to the service account:
   - `Vertex AI User` (for Genkit AI features)
   - `Firebase Admin` (provides broad access to Firebase services)
5. Click **Done**
6. Find the newly created service account, click the three-dots menu under "Actions", and select **Manage keys**
7. Click **Add Key > Create new key**, choose **JSON**, and click **Create**. A JSON key file will be downloaded to your computer

### Set up Firebase Authentication

1. In the Firebase Console, go to the **Authentication** section
2. Click **Get started** and enable the **Email/Password** sign-in provider

### Set up Firestore

1. In the Firebase Console, go to the **Firestore Database** section
2. Click **Create database** and start in **Production mode**
3. Choose a location for your database
4. In the **Rules** tab, paste the following to allow authenticated users to read and write their own data. **Note**: These are basic rules; for a production app, you should refine them further.

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

### Set up Firebase Storage

1. In the Firebase Console, go to the **Storage** section and click **Get started**
2. Follow the prompts to enable Cloud Storage
3. In the **Rules** tab, paste the following to allow authenticated users to access files.

   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

## 2. Local Installation & Setup

Now that the cloud environment is ready, you can set up the application locally.

### Clone the Repository

```bash
git clone https://github.com/your-username/momentum-platform.git
cd momentum-platform
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

**IMPORTANT**: All environment variables must use the `MOMENTUM_` prefix.

1. Create a new file named `.env` in the root of the project
2. Open the `.env` file and add the following variables:

   ```env
   # Firebase Client-side Config (for browser)
   MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY="AIza..."
   MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
   MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
   MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
   MOMENTUM_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
   MOMENTUM_NEXT_PUBLIC_FIREBASE_APP_ID="1:..."

   # Firebase Server-side Config (for backend actions & Genkit)
   MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type": "service_account", ...}'
   
   # Google API Key (for AI features)
   MOMENTUM_GOOGLE_API_KEY="AIza..."
   
   # Firecrawl API Key (for website crawling in Team Intelligence)
   MOMENTUM_FIRECRAWL_API_KEY="fc-..."
   
   # Replit Mail (optional, for email notifications)
   MOMENTUM_REPLIT_MAIL_SERVICE_TOKEN="..."
   ```

3. **To get the `MOMENTUM_NEXT_PUBLIC_...` values**:
   - Go to your Firebase Console
   - Click the gear icon > **Project settings**
   - In the "General" tab, under "Your apps", select or create a Web app
   - In the "SDK setup and configuration" section, choose **Config**
   - Copy the values from the `firebaseConfig` object and paste them into your `.env` file with the `MOMENTUM_` prefix

4. **To get the `MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON` value**:
   - Open the JSON service account key file you downloaded earlier
   - Copy the **entire content** of the JSON file
   - Paste it as a **single line** string into the `.env` file, enclosed in single quotes

5. **To get the `MOMENTUM_FIRECRAWL_API_KEY`**:
   - Sign up at [Firecrawl](https://www.firecrawl.dev/)
   - Get your API key from the dashboard
   - Add it to your `.env` file with the `MOMENTUM_` prefix

## 3. Running the Application

### Development Server

The application runs both the Next.js frontend and Python FastAPI backend concurrently:

```bash
npm run dev
```

This command starts:
- Next.js development server on port 5000
- Python FastAPI service on port 8000 (ADK agent)

### First-Time Setup

On your first run, you'll need to sign up for an account:

1. Navigate to [http://localhost:5000](http://localhost:5000)
2. Click "Sign Up" and create an account with email/password
3. New users are automatically assigned as Team Leads
4. You'll be redirected to the main event calendar

### Using the Platform

Once logged in, you can:

1. **Set Up Your Team Profile**: Define your team's mission, values, and identity
2. **Build Team Intelligence**: Upload documents, crawl websites, add videos to create your team's knowledge base
3. **Create Events**: Use the Natural Language Event Creator or manual timeline editor
4. **Generate Content**: Leverage AI to create text, images, and videos aligned with your team voice
5. **Collaborate**: Use comments, @mentions, and role-based permissions
6. **Manage Media**: Organize all assets in the unified media library

## Development Scripts

- `npm run dev`: Starts both Next.js and Python FastAPI development servers
- `npm run dev:next`: Starts only the Next.js development server
- `npm run dev:python`: Starts only the Python FastAPI server
- `npm run build`: Creates a production build of the application
- `npm run start`: Starts the production server
- `npm run lint`: Lints the codebase using ESLint
- `npm run typecheck`: Runs the TypeScript compiler to check for type errors

## Architecture

MOMENTUM uses a modern, scalable architecture:

### Frontend (Next.js 15)
- **App Router**: Server and client components for optimal performance
- **React Server Components**: Reduce client-side JavaScript
- **ShadCN UI**: Beautiful, accessible component library
- **Tailwind CSS**: Utility-first styling with custom theme

### Backend (Firebase + Python)
- **Firebase Firestore**: NoSQL database for all application data
- **Firebase Auth**: Secure authentication with email/password
- **Firebase Storage**: Scalable file storage for media assets
- **Python FastAPI**: Hosts Google ADK agent for agentic AI capabilities

### AI Layer (Google Genkit)
- **Gemini**: Advanced text generation with context awareness
- **Imagen 4.0**: High-quality image generation
- **Veo 3.1**: Video generation from text prompts
- **ADK Python Agent**: Fully agentic assistant with tool use capabilities

### Key Design Principles
- **Team Intelligence First**: Everything influenced by team knowledge
- **Mobile-First**: Fully responsive with touch-optimized interfaces
- **Timezone-Aware**: Complete timezone support for global teams
- **RBAC Security**: Role-based access control throughout
- **Audit Trails**: Complete tracking of all changes

## Recent Updates

### October 24, 2025
- Complete mobile responsiveness for Event Calendar with touch-optimized interface
- Full timezone management system with user-selectable timezones
- Enhanced AI Assistant context with Team & Individual Intelligence
- Individual Identity system for personal profiles (70% individual, 30% team)

See `replit.md` for complete update history.

## Contributing

We welcome contributions! Please ensure all environment variables use the `MOMENTUM_` prefix and follow our coding conventions.

## License

Copyright © 2025 MOMENTUM Platform. All rights reserved.

---

**Built with momentum. Executed with intelligence.**
