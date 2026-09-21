import { PromptVersion, GoldenTestCase, EvalRunResult, StudioStorageState } from './types.js';
export declare class PromptStorage {
    private baseDir;
    private stateFilePath;
    private state;
    constructor();
    private loadState;
    saveState(state?: StudioStorageState): void;
    getState(): StudioStorageState;
    getVersions(): PromptVersion[];
    getVersion(id: string): PromptVersion | undefined;
    addVersion(name: string, description: string, systemPrompt: string, tags?: string[]): PromptVersion;
    setActiveVersion(versionId: string): boolean;
    addTestCase(testCase: Omit<GoldenTestCase, 'id'>): GoldenTestCase;
    recordEvalResult(result: EvalRunResult): void;
}
