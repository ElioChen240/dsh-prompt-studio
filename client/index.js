if (typeof window !== 'undefined' && window.__ModuleLoader__ && window.__ModuleLoader__.load) {
  window.__ModuleLoader__.load({
    id: "dsh-prompt-studio",
    factory: (require) => {
      const module = { exports: {} };
      const exports = module.exports;
      const React = require("react");

      exports.inject = ["slots"];

      exports.apply = function(ctx) {
        const slots = ctx.get ? ctx.get('slots') : ctx.slots;
        if (!slots) return;

        slots.inject('settings.section', () => {
          return slots.register({
            name: 'settings.section',
            id: 'prompt-studio-settings',
            order: 45,
            label: () => 'Prompt Studio',
            icon: 'sliders'
          }, (props) => {
            return React.createElement(PromptStudioView, { ctx, React });
          });
        });
      };

      function PromptStudioView({ ctx, React }) {
        const [state, setState] = React.useState(null);
        const [activeTab, setActiveTab] = React.useState('editor');
        const [currentPrompt, setCurrentPrompt] = React.useState('');
        const [commitName, setCommitName] = React.useState('');
        const [commitDesc, setCommitDesc] = React.useState('');
        const [evalLoading, setEvalLoading] = React.useState(false);
        const [statusMsg, setStatusMsg] = React.useState('');

        const refreshState = async () => {
          try {
            const res = await fetch('/api/dsh-prompt-studio/state');
            if (res.ok) {
              const data = await res.json();
              setState(data);
              if (data && data.versions) {
                const active = data.versions.find(v => v.id === data.currentActiveVersionId) || data.versions[0];
                if (active) setCurrentPrompt(active.systemPrompt);
              }
            } else {
              fallbackState();
            }
          } catch (e) {
            console.warn('[PromptStudio Client] Fetch failed, using fallback:', e);
            fallbackState();
          }
        };

        const fallbackState = () => {
          const defaultData = {
            currentActiveVersionId: 'v1-init',
            versions: [{
              id: 'v1-init',
              version: 1,
              name: 'Base Assistant',
              description: 'Default DeepSeek Harness system instruction baseline',
              systemPrompt: 'You are an elite coding assistant and software architect powered by DeepSeek Harness. Always deliver concise, robust, and cleanly typed solutions.',
              createdAt: Date.now(),
              metrics: { tokenCount: 28 }
            }],
            testCases: [{
              id: 'tc-lru',
              title: 'LRU Cache Implementation',
              category: 'coding',
              inputPrompt: 'Write a clean TypeScript LRU Cache class with get and put methods.'
            }],
            evalResults: []
          };
          setState(defaultData);
          setCurrentPrompt(defaultData.versions[0].systemPrompt);
        };

        React.useEffect(() => {
          refreshState();
        }, []);

        const handleCommit = async () => {
          if (!commitName.trim() || !currentPrompt.trim()) {
            setStatusMsg('Please provide a version title and non-empty prompt.');
            return;
          }
          try {
            await fetch('/api/dsh-prompt-studio/commit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: commitName,
                description: commitDesc || 'Updated via Prompt Studio',
                systemPrompt: currentPrompt,
                tags: ['studio']
              })
            });
            setCommitName('');
            setCommitDesc('');
            setStatusMsg('✅ Version successfully committed to timeline!');
            await refreshState();
          } catch (err) {
            setStatusMsg('❌ Failed to commit version: ' + err.message);
          }
        };

        const handleActivate = async (versionId) => {
          try {
            await fetch('/api/dsh-prompt-studio/activate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ versionId })
            });
            setStatusMsg('🚀 Active system prompt switched!');
            await refreshState();
          } catch (err) {
            setStatusMsg('❌ Failed to activate: ' + err.message);
          }
        };

        const handleRunEval = async (testCaseId) => {
          if (!state || !state.currentActiveVersionId) return;
          setEvalLoading(true);
          try {
            await fetch('/api/dsh-prompt-studio/eval', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                versionId: state.currentActiveVersionId,
                testCaseId
              })
            });
            await refreshState();
            setStatusMsg('🎯 Benchmark test evaluated!');
          } catch (err) {
            setStatusMsg('❌ Evaluation error: ' + err.message);
          } finally {
            setEvalLoading(false);
          }
        };


        if (!state) {
          return React.createElement('div', { style: { padding: '24px', color: '#888' } }, 'Loading Prompt Studio...');
        }

        const activeVersion = state.versions.find(v => v.id === state.currentActiveVersionId) || state.versions[0];

        return React.createElement('div', {
          style: {
            padding: '24px',
            maxWidth: '1080px',
            margin: '0 auto',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: 'var(--dsh-text-primary, #e6edf3)'
          }
        }, [
          React.createElement('div', {
            key: 'header',
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }
          }, [
            React.createElement('div', { key: 'title-box' }, [
              React.createElement('h2', { style: { margin: 0, fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' } }, [
                '⚡ Prompt Studio',
                React.createElement('span', {
                  style: { fontSize: '12px', background: '#238636', color: '#fff', padding: '2px 8px', borderRadius: '12px' }
                }, `Active: v${activeVersion ? activeVersion.version : 1}`)
              ]),
              React.createElement('p', { style: { margin: '4px 0 0 0', fontSize: '13px', color: '#8b949e' } }, 'Git-style prompt versioning, timeline diff, and golden regression testing.')
            ]),
            React.createElement('div', { key: 'tabs', style: { display: 'flex', gap: '8px' } }, [
              React.createElement('button', {
                key: 'tab-edit',
                onClick: () => setActiveTab('editor'),
                style: {
                  padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: activeTab === 'editor' ? '#1f6feb' : '#21262d', color: '#fff', fontWeight: 500
                }
              }, '📝 Prompt Editor'),
              React.createElement('button', {
                key: 'tab-versions',
                onClick: () => setActiveTab('versions'),
                style: {
                  padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: activeTab === 'versions' ? '#1f6feb' : '#21262d', color: '#fff', fontWeight: 500
                }
              }, `⏳ Version History (${state.versions.length})`),
              React.createElement('button', {
                key: 'tab-eval',
                onClick: () => setActiveTab('benchmark'),
                style: {
                  padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: activeTab === 'benchmark' ? '#1f6feb' : '#21262d', color: '#fff', fontWeight: 500
                }
              }, `🎯 Golden Bench (${state.testCases.length})`)
            ])
          ]),

          statusMsg ? React.createElement('div', {
            key: 'status',
            style: { padding: '10px 14px', marginBottom: '16px', background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', fontSize: '13px' }
          }, statusMsg) : null,

          activeTab === 'editor' ? React.createElement('div', { key: 'tab-content-editor' }, [
            React.createElement('div', { style: { marginBottom: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#8b949e' } }, [
              React.createElement('span', null, 'System Instruction Draft'),
              React.createElement('span', null, `Approx Tokens: ~${Math.ceil(currentPrompt.length / 3.5)}`)
            ]),
            React.createElement('textarea', {
              value: currentPrompt,
              onChange: (e) => setCurrentPrompt(e.target.value),
              placeholder: 'Enter system instructions here...',
              rows: 12,
              style: {
                width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px',
                background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', fontSize: '14px',
                fontFamily: 'monospace', resize: 'vertical', outline: 'none'
              }
            }),
            React.createElement('div', {
              style: { marginTop: '16px', padding: '16px', background: '#161b22', borderRadius: '8px', border: '1px solid #30363d' }
            }, [
              React.createElement('h4', { style: { margin: '0 0 12px 0', fontSize: '14px' } }, 'Commit New Prompt Version'),
              React.createElement('div', { style: { display: 'flex', gap: '12px', marginBottom: '10px' } }, [
                React.createElement('input', {
                  type: 'text',
                  value: commitName,
                  onChange: (e) => setCommitName(e.target.value),
                  placeholder: 'Version tag/name (e.g. Strict Typing Mode)',
                  style: { flex: 1, padding: '8px 12px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', borderRadius: '6px' }
                }),
                React.createElement('input', {
                  type: 'text',
                  value: commitDesc,
                  onChange: (e) => setCommitDesc(e.target.value),
                  placeholder: 'Reason for change (optional)',
                  style: { flex: 2, padding: '8px 12px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', borderRadius: '6px' }
                })
              ]),
              React.createElement('button', {
                onClick: handleCommit,
                style: {
                  padding: '8px 18px', background: '#238636', color: '#fff', border: 'none', borderRadius: '6px',
                  cursor: 'pointer', fontWeight: 600, fontSize: '13px'
                }
              }, '💾 Commit & Create Snapshot')
            ])
          ]) : null,

          activeTab === 'versions' ? React.createElement('div', { key: 'tab-content-versions' }, [
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
              state.versions.map(v => {
                const isActive = v.id === state.currentActiveVersionId;
                return React.createElement('div', {
                  key: v.id,
                  style: {
                    padding: '16px', borderRadius: '8px', background: '#161b22', border: isActive ? '1px solid #238636' : '1px solid #30363d',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }
                }, [
                  React.createElement('div', { key: 'info' }, [
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                      React.createElement('strong', { style: { fontSize: '15px' } }, `v${v.version} · ${v.name}`),
                      isActive ? React.createElement('span', {
                        style: { background: '#238636', color: '#fff', fontSize: '11px', padding: '1px 6px', borderRadius: '8px' }
                      }, 'CURRENT ACTIVE') : null
                    ]),
                    React.createElement('p', { style: { margin: '6px 0 0 0', fontSize: '13px', color: '#8b949e' } }, v.description),
                    React.createElement('div', { style: { marginTop: '8px', fontSize: '12px', color: '#6e7681' } }, [
                      `Created: ${new Date(v.createdAt).toLocaleString()} · Approx Tokens: ~${v.metrics ? v.metrics.tokenCount : 'N/A'}`
                    ])
                  ]),
                  React.createElement('div', { key: 'actions', style: { display: 'flex', gap: '8px' } }, [
                    !isActive ? React.createElement('button', {
                      onClick: () => handleActivate(v.id),
                      style: { padding: '6px 12px', background: '#1f6feb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }
                    }, '⚡ Rollback to This') : null,
                    React.createElement('button', {
                      onClick: () => {
                        setCurrentPrompt(v.systemPrompt);
                        setActiveTab('editor');
                        setStatusMsg(`Loaded v${v.version} into editor draft.`);
                      },
                      style: { padding: '6px 12px', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }
                    }, 'Load to Draft')
                  ])
                ]);
              })
            )
          ]) : null,

          activeTab === 'benchmark' ? React.createElement('div', { key: 'tab-content-eval' }, [
            React.createElement('div', { style: { marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
              React.createElement('h3', { style: { margin: 0, fontSize: '16px' } }, 'Golden Test Regression Bench'),
              React.createElement('span', { style: { fontSize: '13px', color: '#8b949e' } }, `Target: v${activeVersion ? activeVersion.version : 1}`)
            ]),
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
              state.testCases.map(tc => {
                const latestResult = state.evalResults.find(r => r.testCaseId === tc.id && r.versionId === state.currentActiveVersionId);
                return React.createElement('div', {
                  key: tc.id,
                  style: { padding: '16px', background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }
                }, [
                  React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                    React.createElement('div', null, [
                      React.createElement('strong', { style: { fontSize: '15px' } }, tc.title),
                      React.createElement('span', { style: { marginLeft: '8px', fontSize: '11px', background: '#30363d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' } }, tc.category)
                    ]),
                    React.createElement('button', {
                      disabled: evalLoading,
                      onClick: () => handleRunEval(tc.id),
                      style: { padding: '6px 14px', background: '#238636', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }
                    }, evalLoading ? 'Running...' : '▶ Run Eval')
                  ]),
                  React.createElement('p', { style: { margin: '8px 0', fontSize: '13px', color: '#c9d1d9' } }, `Test Input: "${tc.inputPrompt}"`),
                  latestResult ? React.createElement('div', {
                    style: {
                      marginTop: '10px', padding: '10px', borderRadius: '6px',
                      background: latestResult.passed ? 'rgba(35, 134, 54, 0.15)' : 'rgba(218, 54, 51, 0.15)',
                      border: latestResult.passed ? '1px solid rgba(35, 134, 54, 0.4)' : '1px solid rgba(218, 54, 51, 0.4)',
                      fontSize: '12px'
                    }
                  }, [
                    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontWeight: 600 } }, [
                      React.createElement('span', { style: { color: latestResult.passed ? '#3fb950' : '#f85149' } },
                        latestResult.passed ? `PASSED (${latestResult.score}/100)` : `FAILED (${latestResult.score}/100)`
                      ),
                      React.createElement('span', { style: { color: '#8b949e' } }, `Latency: ${latestResult.latencyMs}ms`)
                    ]),
                    React.createElement('div', { style: { marginTop: '4px', color: '#8b949e' } }, latestResult.feedback)
                  ]) : React.createElement('div', { style: { marginTop: '8px', fontSize: '12px', color: '#6e7681' } }, 'Not yet evaluated for current version.')
                ]);
              })
            )
          ]) : null
        ]);
      }

      return module.exports;
    }
  });
}

