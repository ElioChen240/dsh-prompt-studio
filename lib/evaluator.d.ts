import { GoldenTestCase, EvalRunResult } from './types.js';
export declare class EvaluatorEngine {
    /**
     * 自动对 Agent 生成的回答针对 GoldenTestCase 进行客观评测
     */
    evaluateOutput(testCase: GoldenTestCase, output: string, latencyMs: number): Omit<EvalRunResult, 'runId' | 'versionId' | 'testCaseId' | 'timestamp'>;
}
