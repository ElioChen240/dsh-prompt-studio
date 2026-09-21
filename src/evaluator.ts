import { PromptVersion, GoldenTestCase, EvalRunResult } from './types.js';

export class EvaluatorEngine {
  /**
   * 自动对 Agent 生成的回答针对 GoldenTestCase 进行客观评测
   */
  public evaluateOutput(testCase: GoldenTestCase, output: string, latencyMs: number): Omit<EvalRunResult, 'runId' | 'versionId' | 'testCaseId' | 'timestamp'> {
    let score = 100;
    const feedbackList: string[] = [];

    // 1. 检查命中预期关键字
    const missingExpected = testCase.expectedKeywords.filter(
      kw => !output.toLowerCase().includes(kw.toLowerCase())
    );
    if (missingExpected.length > 0) {
      const penalty = Math.min(60, (missingExpected.length / Math.max(1, testCase.expectedKeywords.length)) * 60);
      score -= penalty;
      feedbackList.push(`Missing expected keywords: [${missingExpected.join(', ')}] (-${Math.round(penalty)}pts)`);
    }

    // 2. 检查违规/不应出现的关键词
    const hitForbidden = testCase.forbiddenKeywords.filter(
      kw => output.toLowerCase().includes(kw.toLowerCase())
    );
    if (hitForbidden.length > 0) {
      const penalty = Math.min(50, hitForbidden.length * 25);
      score -= penalty;
      feedbackList.push(`Hit forbidden/unsafe keywords: [${hitForbidden.join(', ')}] (-${Math.round(penalty)}pts)`);
    }

    // 3. 输出长度与质量兜底
    if (output.trim().length < 20) {
      score -= 30;
      feedbackList.push('Output too short or degraded (-30pts)');
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const passed = score >= 70;

    return {
      output,
      passed,
      score,
      latencyMs,
      tokensUsed: Math.ceil(output.length / 3.8),
      feedback: feedbackList.length > 0 ? feedbackList.join('; ') : 'All test criteria met flawlessly!'
    };
  }
}
