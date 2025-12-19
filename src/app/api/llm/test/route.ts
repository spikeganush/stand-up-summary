import { NextRequest, NextResponse } from "next/server";
import type { LLMProvider } from "@/stores/settings-store";

/**
 * Test OpenAI API key by listing models
 */
async function testOpenAI(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || `API returned status ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to OpenAI",
    };
  }
}

/**
 * Test Anthropic API key with a minimal message
 */
async function testAnthropic(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1,
        messages: [
          {
            role: "user",
            content: "Hi",
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || `API returned status ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to Anthropic",
    };
  }
}

/**
 * Test Google Gemini API key by listing models
 */
async function testGoogle(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || `API returned status ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to Google",
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, apiKey } = body as {
      provider: LLMProvider;
      apiKey: string;
    };

    if (!provider) {
      return NextResponse.json(
        { success: false, error: "No provider specified" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "No API key provided" },
        { status: 400 }
      );
    }

    let result: { success: boolean; error?: string };

    switch (provider) {
      case "openai":
        result = await testOpenAI(apiKey);
        break;
      case "anthropic":
        result = await testAnthropic(apiKey);
        break;
      case "google":
        result = await testGoogle(apiKey);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported provider: ${provider}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error testing API connection:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to test connection",
      },
      { status: 500 }
    );
  }
}

