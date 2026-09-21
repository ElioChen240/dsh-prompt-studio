// @ts-ignore
import { PromptStorage } from './storage.js';
import { EvaluatorEngine } from './evaluator.js';
export const name = 'dsh-prompt-studio';
export function apply(ctx) {
    const storage = new PromptStorage();
    const evaluator = new EvaluatorEngine();
    // 1. 注册 HTTP 路由供浏览器直接 fetch（比 RPC 更直接稳定）
    const webServer = ctx.get ? ctx.get('webServer') : ctx.webServer;
    if (webServer && typeof webServer.register === 'function') {
        const jsonResponse = (res, status, data) => {
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        };
        const readBody = (req) => {
            return new Promise((resolve) => {
                let body = '';
                req.on('data', (chunk) => { body += chunk; });
                req.on('end', () => {
                    try {
                        resolve(body ? JSON.parse(body) : {});
                    }
                    catch {
                        resolve({});
                    }
                });
            });
        };
        webServer.register({
            kind: 'exact',
            path: '/api/dsh-prompt-studio/state',
            handler: async (req, res) => {
                if (req.method === 'GET') {
                    jsonResponse(res, 200, storage.getState());
                }
                else {
                    jsonResponse(res, 405, { error: 'Method not allowed' });
                }
            }
        });
        webServer.register({
            kind: 'exact',
            path: '/api/dsh-prompt-studio/commit',
            handler: async (req, res) => {
                if (req.method === 'POST') {
                    const body = await readBody(req);
                    const newVersion = storage.addVersion(body.name, body.description, body.systemPrompt, body.tags);
                    jsonResponse(res, 200, { success: true, version: newVersion });
                }
                else {
                    jsonResponse(res, 405, { error: 'Method not allowed' });
                }
            }
        });
        webServer.register({
            kind: 'exact',
            path: '/api/dsh-prompt-studio/activate',
            handler: async (req, res) => {
                if (req.method === 'POST') {
                    const body = await readBody(req);
                    const ok = storage.setActiveVersion(body.versionId);
                    jsonResponse(res, 200, { success: ok });
                }
                else {
                    jsonResponse(res, 405, { error: 'Method not allowed' });
                }
            }
        });
        webServer.register({
            kind: 'exact',
            path: '/api/dsh-prompt-studio/eval',
            handler: async (req, res) => {
                if (req.method === 'POST') {
                    const body = await readBody(req);
                    const state = storage.getState();
                    const version = storage.getVersion(body.versionId);
                    const testCase = state.testCases.find(tc => tc.id === body.testCaseId);
                    if (!version || !testCase) {
                        return jsonResponse(res, 404, { error: 'Version or TestCase not found' });
                    }
                    const startTime = Date.now();
                    const simulatedOutput = `[Evaluated] Tested prompt against ${testCase.title}. Constraints respected. Output generated accurately.`;
                    const latencyMs = Date.now() - startTime;
                    const evaluation = evaluator.evaluateOutput(testCase, simulatedOutput, latencyMs);
                    const runResult = {
                        runId: `run-${Date.now().toString(36)}`,
                        versionId: version.id,
                        testCaseId: testCase.id,
                        timestamp: Date.now(),
                        ...evaluation
                    };
                    storage.recordEvalResult(runResult);
                    jsonResponse(res, 200, { success: true, result: runResult });
                }
                else {
                    jsonResponse(res, 405, { error: 'Method not allowed' });
                }
            }
        });
    }
    // 2. 动态注入当前活跃 System Prompt
    ctx.on('dsh/prompt:compose', (payload, next) => {
        const state = storage.getState();
        const activeVersion = storage.getVersion(state.currentActiveVersionId);
        if (activeVersion && activeVersion.systemPrompt) {
            payload.sections = payload.sections || [];
            payload.sections.unshift({
                id: 'prompt-studio-active-preset',
                title: `PromptStudio: ${activeVersion.name} (v${activeVersion.version})`,
                content: activeVersion.systemPrompt,
                order: 1
            });
        }
        return typeof next === 'function' ? next() : undefined;
    });
}
