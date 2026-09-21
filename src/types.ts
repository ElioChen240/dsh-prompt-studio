export interface PromptVersion {
  id: string;
  version: number;
  name: string;
  description: string;
  systemPrompt: string;
  createdAt: number;
  author?: string;
  tags: string[];
  metrics?: {
    tokenCount: number;
    testPassRate?: number;
    avgLatencyMs?: number;
  };
}

export interface GoldenTestCase {
  id: string;
  title: string;
  category: 'coding' | 'reasoning' | 'refactor' | 'safety' | 'custom';
  inputPrompt: string;
  expectedKeywords: string[];
  forbiddenKeywords: string[];
  evaluationCriteria: string;
}

export interface EvalRunResult {
  runId: string;
  versionId: string;
  testCaseId: string;
  timestamp: number;
  output: string;
  passed: boolean;
  score: number; // 0 - 100
  latencyMs: number;
  tokensUsed: number;
  feedback: string;
}

export interface StudioStorageState {
  currentActiveVersionId: string;
  versions: PromptVersion[];
  testCases: GoldenTestCase[];
  evalResults: EvalRunResult[];
}
