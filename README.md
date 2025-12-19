# Stand-up Summary

AI-powered daily stand-up preparation tool that fetches your GitHub commits, extracts Jira ticket links, and generates summaries using your preferred LLM provider.

## Features

- **GitHub Integration**: Connect your GitHub account and select repositories to track
- **Smart Date Logic**: Automatically fetches previous working day commits (Friday if it's Monday)
- **Jira Integration**: Extracts ticket IDs from branch names and commit messages
- **AI Summaries**: Generate stand-up summaries using OpenAI, Anthropic, or Google
- **Complexity Metrics**: Visual indicators showing commit complexity
- **Docker Ready**: Easy deployment with Docker and docker-compose

## Tech Stack

- **Next.js 16** (App Router)
- **NextAuth v5** (Auth.js) for GitHub OAuth
- **Zustand** with persist middleware
- **shadcn/ui** + Tailwind CSS v4
- **Docker** for containerized deployment

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- GitHub OAuth App credentials

### 1. Clone and Install

```bash
git clone <your-repo>
cd stand-up-summary
pnpm install
```

### 2. Configure Environment

Create a `.env.local` file:

```bash
# Generate a secret: openssl rand -base64 32
AUTH_SECRET="your-secret-key"

# GitHub OAuth App credentials
# Create at: https://github.com/settings/developers
# Callback URL: http://localhost:3000/api/auth/callback/github
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"

# Optional: Custom Jira base URL
NEXT_PUBLIC_JIRA_BASE_URL="https://your-org.atlassian.net/browse"
```

### 3. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Docker

### Development (with hot reload)

```bash
# Start development environment
docker compose up

# Or use watch mode for file sync
docker compose watch
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Production

```bash
# Build and run production
docker compose -f docker-compose.prod.yml up -d

# With custom Postgres password
POSTGRES_PASSWORD=your_secure_password docker compose -f docker-compose.prod.yml up -d
```

## LLM Configuration

This app uses **Bring Your Own Key (BYOK)** model. Configure your API key in the app settings:

- **OpenAI**: Get key at https://platform.openai.com/api-keys
- **Anthropic**: Get key at https://console.anthropic.com/settings/keys
- **Google**: Get key at https://aistudio.google.com/app/apikey

API keys are stored locally in your browser and never sent to our servers.

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes
│   ├── dashboard/     # Dashboard page
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Landing page
├── components/
│   ├── ui/            # shadcn components
│   └── ...            # App components
├── lib/
│   ├── auth.ts        # NextAuth config
│   ├── github.ts      # GitHub API helpers
│   ├── jira.ts        # Jira utilities
│   ├── llm.ts         # LLM client
│   └── utils.ts       # Utilities
└── stores/
    └── settings-store.ts  # Zustand store
```

## License

MIT
