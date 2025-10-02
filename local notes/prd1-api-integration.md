# PRD: Tax research assistant migration for Replit

**Situation**

I created a working MVP in Google AI Studio based on Gemini and Google Search. I am migrating away from Google and plan to build a standalone version. The code was taken directly from Google AI Studio and presented ‘as is’. There are broken integrations that we will work on addressing.

**Objective**
Fix broken Gemini API integration and migrate to OpenAI with Brave Search to create a functional, standalone MVP ready for Replit deployment.

**Critical Path (Required for Replit)**
Phase 1: Core API Migration
Replace non-functional Gemini implementation with working OpenAI integration and search capability.
Phase 2: Environment Setup
Standardize environment variables for Replit secrets management.
Phase 3: System Instructions
Update prompts to match actual API capabilities.

**TODO for Claude Code**

**Critical**

1. Fix API Integration
    
    ```tsx
    // Replace services/geminiService.ts entirely
    // New file: services/aiService.ts
    - Install OpenAI SDK: npm install openai
    - Create OpenAIChat class with proper streaming
    - Implement Brave Search integration with function calling
    - Update Message type to handle tool calls
    ```
    
2. Environment variables
    
    ```bash
    # Create .env.example
    OPENAI_API_KEY=
    BRAVE_SEARCH_API_KEY=
    # Optional for future:
    # ANTHROPIC_API_KEY=
    # SERPER_API_KEY=
    ```
    
    1. Update vite.config.ts to use consistent naming
    2. Update all process.env references
3. Update system instructions
    
    ```tsx
    // constants.ts
    - Remove "Search First, Always" mandate
    - Change to "Search when needed for current information"
    - Remove references to non-existent tools
    - Add function calling instructions
    ```
    

**Important**

1. Implement search caching
    
    ```tsx
    // constants.ts
    - Remove "Search First, Always" mandate
    - Change to "Search when needed for current information"
    - Remove references to non-existent tools
    - Add function calling instructions
    ```
    
2. Fix quick access buttons
    
    ```tsx
    // New file: services/searchCache.ts
    - Cache common queries (tax rates, deadlines)
    - 24-hour TTL for regulatory content
    - Skip cache for date-specific queries
    ```
    
3. 

**Implementation Commands for Claude Code**

```bash
# Step 1: Install dependencies
npm install openai

# Step 2: Create new service file
touch services/aiService.ts

# Step 3: Create search service
touch services/searchService.ts

# Step 4: Update environment example
touch .env.example

# Step 5: Test locally before Replit
npm run dev
```

**File Modification Order**

- `services/aiService.ts` (new)
- `services/searchService.ts` (new)
- `vite.config.ts` (update env vars)
- `App.tsx` (import new service)
- `constants.ts` (update instructions)
- `components/Sidebar.tsx` (wire buttons)
- `.env.example` (create)
- `package.json` (add openai dependency)
- Delete `services/geminiService.ts`

**Success criteria**

- App initializes without errors
- Chat sends/receives messages via OpenAI
- Search results appear with citations
- Quick access buttons work
- Ready for `git push` to Replit