"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  GitBranch,
  Sparkles,
  Clock,
  Zap,
  Shield,
  ArrowRight,
  Github,
} from "lucide-react";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center dark animated-gradient">
        <div className="animate-pulse flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          <span className="text-xl font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen dark animated-gradient">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-chart-2/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-20 sm:py-32">
          {/* Header */}
          <nav className="flex items-center justify-between mb-20">
            <div className="flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Stand-up Summary</span>
            </div>
          </nav>

          {/* Hero Content */}
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-8">
              <Zap className="h-4 w-4" />
              <span>AI-Powered Daily Summaries</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
              <span className="gradient-text">Never forget</span>
              <br />
              what you worked on
            </h1>

            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Connect your GitHub, select your repos, and get an AI-generated
              summary of yesterday&apos;s commits. Perfect for daily stand-ups.
            </p>

            <Button
              size="lg"
              className="gap-2 text-lg px-8 py-6 glow"
              onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
            >
              <Github className="h-5 w-5" />
              Sign in with GitHub
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">
            Everything you need for stand-ups
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Stop scrambling to remember what you did yesterday. Let AI do the
            heavy lifting.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="glass border-border/50 hover:border-primary/30 transition-all hover:glow">
            <CardContent className="p-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <GitBranch className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">GitHub Integration</h3>
              <p className="text-sm text-muted-foreground">
                Connect your GitHub account and select which repositories to
                track. Works with both personal and organization repos.
              </p>
            </CardContent>
          </Card>

          <Card className="glass border-border/50 hover:border-primary/30 transition-all hover:glow">
            <CardContent className="p-6">
              <div className="h-12 w-12 rounded-lg bg-chart-2/10 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-chart-2" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI Summaries</h3>
              <p className="text-sm text-muted-foreground">
                Get intelligent summaries of your commits using OpenAI,
                Anthropic, or Google. Bring your own API key.
              </p>
            </CardContent>
          </Card>

          <Card className="glass border-border/50 hover:border-primary/30 transition-all hover:glow">
            <CardContent className="p-6">
              <div className="h-12 w-12 rounded-lg bg-chart-3/10 flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-chart-3" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Smart Timing</h3>
              <p className="text-sm text-muted-foreground">
                Automatically fetches the previous working day&apos;s commits.
                Monday? It shows Friday&apos;s work.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Features */}
        <div className="mt-16 grid md:grid-cols-2 gap-6">
          <Card className="glass border-border/50">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Jira Integration</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically extracts Jira ticket IDs from your branch names
                  and commit messages, with direct links to your tickets.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-chart-5/10 flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-chart-5" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Complexity Metrics</h3>
                <p className="text-sm text-muted-foreground">
                  See at a glance how complex your changes were with metrics on
                  commits, lines changed, and files modified.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            Built with Next.js, shadcn/ui, and a lot of ☕
          </p>
        </div>
      </footer>
    </div>
  );
}
