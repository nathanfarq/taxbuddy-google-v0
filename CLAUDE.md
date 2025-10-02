# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Keep This File Updated

**When making significant changes to this codebase, always update this CLAUDE.md file to reflect:**
- New development commands, build processes, or environment requirements
- Architecture changes, new components, or service modifications  
- Changes to core features, API integrations, or data models
- New dependencies, configuration files, or deployment processes
- Updates to testing, linting, or other development workflows

**Additionally, when making any commits, always update the CHANGELOG.md file:**
- Add new entries to the [Unreleased] section using the appropriate category (Added, Changed, Deprecated, Removed, Fixed, Security)
- Follow the Keep a Changelog format with clear, descriptive entries
- When creating a new release/version, move [Unreleased] items to a new version section with the release date

This ensures future Claude Code instances have accurate, current information about the project and its evolution.

## Project Overview

This is a React + TypeScript tax research assistant application powered by OpenAI API. The app provides a chat interface for tax professionals to ask questions and receive sourced, factual responses focused on Canadian tax law.

## Development Commands

- **Start development server**: `npm run dev`
- **Build for production**: `npm run build`
- **Preview production build**: `npm run preview`
- **Install dependencies**: `npm install`

## Environment Setup

The application requires the following environment variables set in `.env.local` to function:
- `OPENAI_API_KEY`: Your OpenAI API key for ChatGPT models
- `BRAVE_SEARCH_API_KEY`: Your Brave Search API key for web search functionality

The app will throw errors if these are not configured. A template `.env.local` file is provided with placeholder values.

## Architecture

### Core State Management
- **App.tsx**: Main application component managing conversation state, token tracking, and AI service coordination
- **Conversation Management**: Each conversation has a unique ID, title, and message history. Conversations are stored in React state with no persistence
- **Token Tracking**: Implements client-side token counting (1 token ≈ 4 characters) with warnings at 7192 tokens and hard limit at 8192 tokens

### AI Service Layer
- **services/openaiService.ts**: Handles all OpenAI API interactions
  - `TaxResearchChat` class: Manages chat sessions with streaming responses using GPT-4o model
  - `classifyInquiry()` function: Generates conversation titles from first user message using GPT-4o-mini
- **services/braveSearchService.ts**: Handles web search functionality
  - `searchWeb()` function: Performs web searches using Brave Search API
  - `searchTaxResources()` function: Enhanced search with tax-specific context

### Component Structure
- **Sidebar**: Conversation list and new chat functionality
- **ChatWindow**: Main chat interface with message display and input
- **Message**: Individual message rendering with source citations and feedback buttons
- **ChatInput**: User input with send functionality
- **TokenWarningPopup**: Displays when approaching token limits
- **icons/**: SVG icon components

### Type System
- **types.ts**: Core interfaces for `Message`, `Conversation`, `Source`, `Role` enum, and `Feedback` enum
- Messages support optional source citations and user feedback (thumbs up/down)

### Configuration
- **constants.ts**: System instructions for the AI, token limits, and warning thresholds
- System instructions define the AI as a Canadian tax-focused research assistant with mandatory web search and source citation requirements

## Key Features

1. **Streaming Responses**: Real-time message updates as AI generates responses
2. **Source Grounding**: AI responses include clickable citations from Brave Search web results
3. **Context Management**: Automatic token counting and warnings to prevent context overflow
4. **Conversation Switching**: Multiple conversation threads (note: switching creates new AI sessions)
5. **User Feedback**: Thumbs up/down feedback system for AI responses

## Development Notes

- Uses Vite for build tooling with React plugin
- No testing framework currently configured
- No linting configuration present
- Chat sessions are recreated when switching conversations (doesn't maintain conversation history in AI context)
- Feedback is logged to console but not persisted to any backend