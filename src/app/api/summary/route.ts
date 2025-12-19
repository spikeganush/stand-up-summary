import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateSummary } from "@/lib/llm";
import type { CommitWithDetails } from "@/lib/github";
import type { LLMProvider } from "@/stores/settings-store";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { commits, provider, apiKey } = body as {
      commits: CommitWithDetails[];
      provider: LLMProvider;
      apiKey: string;
    };

    if (!commits || !Array.isArray(commits)) {
      return NextResponse.json(
        { error: "No commits provided" },
        { status: 400 }
      );
    }

    if (!provider) {
      return NextResponse.json(
        { error: "No LLM provider specified" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key provided" },
        { status: 400 }
      );
    }

    const summary = await generateSummary(commits, provider, apiKey);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Error generating summary:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to generate summary";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

