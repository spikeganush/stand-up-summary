"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useSettingsStore, type LLMProvider } from "@/stores/settings-store";
import {
  Settings,
  Eye,
  EyeOff,
  ExternalLink,
  Github,
  Sparkles,
  Ticket,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface LLMSettingsProps {
  className?: string;
}

const providerInfo: Record<
  LLMProvider,
  { name: string; description: string; keyUrl: string }
> = {
  openai: {
    name: "OpenAI",
    description: "GPT-5 mini - Fast and cost-effective",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude Haiku 4.5 - Excellent reasoning",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  google: {
    name: "Google",
    description: "Gemini 3 Flash - Quick responses",
    keyUrl: "https://aistudio.google.com/app/apikey",
  },
};

type TestStatus = "idle" | "testing" | "success" | "error";

export function LLMSettings({ className }: LLMSettingsProps) {
  const [showLLMKey, setShowLLMKey] = useState(false);
  const [showGitHubPat, setShowGitHubPat] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testError, setTestError] = useState<string>("");

  const {
    llmProvider,
    apiKeys,
    githubPat,
    useGithubPat,
    jiraBaseUrl,
    setLLMProvider,
    setApiKey,
    setGithubPat,
    setUseGithubPat,
    setJiraBaseUrl,
  } = useSettingsStore();

  const currentProvider = providerInfo[llmProvider];
  const hasLLMKey = !!apiKeys[llmProvider];
  const hasGitHubPat = !!githubPat;
  const currentApiKey = apiKeys[llmProvider] || "";

  // Reset test status when provider or key changes
  useEffect(() => {
    setTestStatus("idle");
    setTestError("");
  }, [llmProvider, currentApiKey]);

  const testConnection = useCallback(async () => {
    if (!currentApiKey) return;

    setTestStatus("testing");
    setTestError("");

    try {
      const response = await fetch("/api/llm/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: llmProvider,
          apiKey: currentApiKey,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestStatus("success");
      } else {
        setTestStatus("error");
        setTestError(data.error || "Connection failed");
      }
    } catch (error) {
      setTestStatus("error");
      setTestError(
        error instanceof Error ? error.message : "Connection failed"
      );
    }
  }, [llmProvider, currentApiKey]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={cn("gap-2", className)}>
          <Settings className="h-4 w-4" />
          <span>Settings</span>
          {(!hasLLMKey || (useGithubPat && !hasGitHubPat)) && (
            <span className="h-2 w-2 rounded-full bg-destructive" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your AI provider and GitHub access. All keys are stored
            locally in your browser.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="llm" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="llm" className="gap-2">
              <Sparkles className="h-4 w-4" />
              AI
            </TabsTrigger>
            <TabsTrigger value="github" className="gap-2">
              <Github className="h-4 w-4" />
              GitHub
            </TabsTrigger>
            <TabsTrigger value="jira" className="gap-2">
              <Ticket className="h-4 w-4" />
              Jira
            </TabsTrigger>
          </TabsList>

          {/* AI Provider Tab */}
          <TabsContent value="llm" className="space-y-6 py-4">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={llmProvider}
                onValueChange={(value) => setLLMProvider(value as LLMProvider)}
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(providerInfo).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col items-start">
                        <span>{info.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {info.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="apiKey">API Key</Label>
                <a
                  href={currentProvider.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Get API key
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="apiKey"
                    type={showLLMKey ? "text" : "password"}
                    placeholder={`Enter your ${currentProvider.name} API key`}
                    value={apiKeys[llmProvider] || ""}
                    onChange={(e) => setApiKey(llmProvider, e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowLLMKey(!showLLMKey)}
                  >
                    {showLLMKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={testConnection}
                  disabled={!hasLLMKey || testStatus === "testing"}
                  className="shrink-0"
                >
                  {testStatus === "testing" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Testing...
                    </>
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              {/* Test result feedback */}
              {testStatus === "success" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400">
                    Connection successful! Your {currentProvider.name} API key
                    is working.
                  </span>
                </div>
              )}
              {testStatus === "error" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <span className="text-sm text-destructive font-medium">
                      Connection failed
                    </span>
                    {testError && (
                      <p className="text-xs text-destructive/80">{testError}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Configuration status */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/50">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    hasLLMKey ? "bg-green-500" : "bg-destructive"
                  )}
                />
                <span className="text-sm">
                  {hasLLMKey
                    ? `${currentProvider.name} is configured`
                    : `Add your ${currentProvider.name} API key to enable AI summaries`}
                </span>
              </div>
            </div>
          </TabsContent>

          {/* GitHub Tab */}
          <TabsContent value="github" className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="useGithubPat"
                  checked={useGithubPat}
                  onCheckedChange={(checked) =>
                    setUseGithubPat(checked as boolean)
                  }
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="useGithubPat"
                    className="font-medium cursor-pointer"
                  >
                    Use Personal Access Token
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enable this if OAuth can&apos;t access some of your org
                    repos. PATs bypass OAuth app restrictions.
                  </p>
                </div>
              </div>

              {useGithubPat && (
                <>
                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="githubPat">Personal Access Token</Label>
                      <a
                        href="https://github.com/settings/tokens?type=beta"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Create token
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="relative">
                      <Input
                        id="githubPat"
                        type={showGitHubPat ? "text" : "password"}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        value={githubPat}
                        onChange={(e) => setGithubPat(e.target.value)}
                        className="pr-10 font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowGitHubPat(!showGitHubPat)}
                      >
                        {showGitHubPat ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Create a fine-grained PAT with <strong>repo</strong>{" "}
                      access to your organization&apos;s repositories.
                    </p>
                  </div>

                  {/* PAT Status */}
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/50">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        hasGitHubPat ? "bg-green-500" : "bg-destructive"
                      )}
                    />
                    <span className="text-sm">
                      {hasGitHubPat
                        ? "GitHub PAT is configured"
                        : "Add your GitHub PAT to access restricted repos"}
                    </span>
                  </div>
                </>
              )}

              {!useGithubPat && (
                <div className="p-3 rounded-lg bg-accent/50">
                  <p className="text-sm text-muted-foreground">
                    Currently using GitHub OAuth for repository access. If you
                    can&apos;t see some org repos, enable PAT mode above.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Jira Tab */}
          <TabsContent value="jira" className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="jiraBaseUrl">Jira Base URL</Label>
                <Input
                  id="jiraBaseUrl"
                  type="url"
                  placeholder="https://your-company.atlassian.net/browse"
                  value={jiraBaseUrl}
                  onChange={(e) => setJiraBaseUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The base URL for your Jira instance. Ticket IDs will be
                  appended to this URL (e.g., SC-1234 → {jiraBaseUrl}/SC-1234).
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Ticket Detection
                </Label>
                <p className="text-xs text-muted-foreground">
                  Tickets are automatically extracted from:
                </p>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 ml-2">
                  <li>
                    Branch names (e.g., <code>feature/SC-1234</code>)
                  </li>
                  <li>PR titles and branch names</li>
                  <li>Commit messages</li>
                </ul>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/50">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    jiraBaseUrl ? "bg-green-500" : "bg-yellow-500"
                  )}
                />
                <span className="text-sm">
                  {jiraBaseUrl
                    ? "Jira integration configured"
                    : "Add your Jira URL to enable ticket links"}
                </span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
