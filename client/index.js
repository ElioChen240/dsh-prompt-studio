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
            label: () => '提示词配置',
            icon: 'sliders'
          }, (props) => {
            return React.createElement(PromptStudioView, { ctx, React });
          });
        });
      };

      // 文本与 Token 指标分析
      function analyzeTextMetrics(text) {
        if (!text || text.length === 0) {
          return { tokens: 0, chars: 0, lines: 0, ratio: '0.0%' };
        }
        const lines = text.split('\n').length;
        const chars = text.length;
        const zhMatches = text.match(/[\u4e00-\u9fa5]/g);
        const zhChars = zhMatches ? zhMatches.length : 0;
        const enMatches = text.match(/[a-zA-Z0-9_-]+/g);
        const enWords = enMatches ? enMatches.length : 0;
        const tokens = Math.max(1, Math.round(zhChars * 0.72 + enWords * 1.3 + (chars - zhChars) * 0.15));
        const ratio = ((tokens / 65536) * 100).toFixed(1) + '%';
        return { tokens, chars, lines, ratio };
      }

      // 预置规则片段（严谨工程用词，去卡通/去表情化）
      const STANDARD_CONSTRAINTS = [
        { label: '禁止 TODO 占位', text: '\n\n[规范要求] 禁止输出 TODO 或未完成占位代码，必须输出完整可运行的实现。' },
        { label: '严格类型检查', text: '\n\n[规范要求] 必须遵循严格 TypeScript 类型定义，避免使用 any。' },
        { label: '精简输出', text: '\n\n[规范要求] 仅输出必要代码与关键逻辑解释，省略无意义客套说明。' },
        { label: '附带单元测试', text: '\n\n[规范要求] 业务代码编写完成后，应附带覆盖主路径与异常分支的单元测试。' }
      ];

      function PromptStudioView({ ctx, React }) {
        const [state, setState] = React.useState(null);
        const [activeTab, setActiveTab] = React.useState('editor'); // editor | versions | tests
        const [currentPrompt, setCurrentPrompt] = React.useState('');
        const [commitName, setCommitName] = React.useState('');
        const [commitDesc, setCommitDesc] = React.useState('');
        const [statusMsg, setStatusMsg] = React.useState('');
        const [hasUnsavedDraft, setHasUnsavedDraft] = React.useState(false);

        const AUTOSAVE_KEY = 'dsh_prompt_studio_draft_v1';

        const metrics = React.useMemo(() => {
          return analyzeTextMetrics(currentPrompt);
        }, [currentPrompt]);

        const refreshState = async () => {
          try {
            const res = await fetch('/api/dsh-prompt-studio/state');
            if (res.ok) {
              const data = await res.json();
              setState(data);
              initPromptDraft(data);
            } else {
              fallbackState();
            }
          } catch (e) {
            fallbackState();
          }
        };

        const initPromptDraft = (data) => {
          const savedDraft = localStorage.getItem(AUTOSAVE_KEY);
          if (savedDraft && savedDraft.trim()) {
            setCurrentPrompt(savedDraft);
            setHasUnsavedDraft(true);
          } else if (data && data.versions) {
            const active = data.versions.find(v => v.id === data.currentActiveVersionId) || data.versions[0];
            if (active) setCurrentPrompt(active.systemPrompt);
          }
        };

        const fallbackState = () => {
          const defaultData = {
            currentActiveVersionId: 'v1-init',
            versions: [{
              id: 'v1-init',
              version: 1,
              name: '默认配置 (Baseline)',
              description: '系统默认基础指令',
              systemPrompt: '你是由 DeepSeek Harness 驱动的代码开发助手。请提供严谨、规范且可维护的代码方案。',
              createdAt: Date.now(),
              metrics: { tokenCount: 28 }
            }],
            testCases: [
              { id: 'tc-lru', title: 'LRU 缓存实现', category: 'coding', inputPrompt: '实现一个 TypeScript LRU Cache 类。' }
            ],
            evalResults: []
          };
          setState(defaultData);
          initPromptDraft(defaultData);
        };

        React.useEffect(() => {
          refreshState();
        }, []);

        const handlePromptChange = (val) => {
          setCurrentPrompt(val);
          setHasUnsavedDraft(true);
          try {
            localStorage.setItem(AUTOSAVE_KEY, val);
          } catch (err) {}
        };

        const handleInsertConstraint = (text) => {
          const newText = (currentPrompt + text).trim();
          handlePromptChange(newText);
          setStatusMsg('已添加规则约束');
        };

        const handleDiscardDraft = () => {
          localStorage.removeItem(AUTOSAVE_KEY);
          setHasUnsavedDraft(false);
          if (state && state.versions) {
            const active = state.versions.find(v => v.id === state.currentActiveVersionId) || state.versions[0];
            if (active) setCurrentPrompt(active.systemPrompt);
          }
          setStatusMsg('已重置为当前激活版本');
        };

        const handleCommit = async () => {
          if (!commitName.trim() || !currentPrompt.trim()) {
            setStatusMsg('请填写版本名称与提示词内容');
            return;
          }
          try {
            await fetch('/api/dsh-prompt-studio/commit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: commitName,
                description: commitDesc || '常规修订',
                systemPrompt: currentPrompt,
                tags: ['revision']
              })
            });
            localStorage.removeItem(AUTOSAVE_KEY);
            setHasUnsavedDraft(false);
            setCommitName('');
            setCommitDesc('');
            setStatusMsg('已创建新修订版本');
            await refreshState();
          } catch (err) {
            setStatusMsg('创建版本失败: ' + err.message);
          }
        };

        const handleActivate = async (versionId) => {
          try {
            await fetch('/api/dsh-prompt-studio/activate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ versionId })
            });
            setStatusMsg('已切换当前激活版本');
            await refreshState();
          } catch (err) {
            setStatusMsg('切换失败: ' + err.message);
          }
        };

        if (!state) {
          return React.createElement('div', {
            style: { padding: '24px', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' }
          }, '加载中...');
        }

        const activeVersion = state.versions.find(v => v.id === state.currentActiveVersionId) || state.versions[0];

        // 极简工业级、去 AI 风格排版（类似 VS Code / Linear 设置页）
        return React.createElement('div', {
          style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxWidth: '920px',
            margin: '0 auto',
            padding: '16px 20px',
            boxSizing: 'border-box',
            fontFamily: 'var(--dsw-font-family, system-ui, -apple-system, sans-serif)',
            color: 'var(--dsw-alias-label-primary)',
            fontSize: '12.5px',
            lineHeight: 1.5
          }
        }, [
          // 顶部栏：克制精简的标题与 Tab 栏
          React.createElement('div', {
            key: 'header',
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--dsw-alias-border-l1)'
            }
          }, [
            React.createElement('div', { key: 'title-wrap', style: { display: 'flex', alignItems: 'baseline', gap: '12px' } }, [
              React.createElement('span', {
                style: { fontSize: '15px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }
              }, '系统提示词配置'),
              React.createElement('span', {
                style: { fontSize: '11.5px', color: 'var(--dsw-alias-label-tertiary)' }
              }, `当前环境: v${activeVersion ? activeVersion.version : 1} (${activeVersion ? activeVersion.name : '基线'})`)
            ]),
            // 严谨风格的 Tab 切换器 (Segmented Control)
            React.createElement('div', {
              key: 'nav-tabs',
              style: {
                display: 'inline-flex',
                background: 'var(--dsw-alias-bg-layer-2)',
                border: '1px solid var(--dsw-alias-border-l1)',
                borderRadius: '6px',
                padding: '2px',
                gap: '2px'
              }
            }, [
              React.createElement('button', {
                key: 'tab-editor',
                onClick: () => setActiveTab('editor'),
                style: {
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  background: activeTab === 'editor' ? 'var(--dsw-alias-bg-base)' : 'transparent',
                  color: activeTab === 'editor' ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
                  fontWeight: activeTab === 'editor' ? 600 : 400,
                  boxShadow: activeTab === 'editor' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }
              }, '指令编辑'),
              React.createElement('button', {
                key: 'tab-versions',
                onClick: () => setActiveTab('versions'),
                style: {
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  background: activeTab === 'versions' ? 'var(--dsw-alias-bg-base)' : 'transparent',
                  color: activeTab === 'versions' ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
                  fontWeight: activeTab === 'versions' ? 600 : 400,
                  boxShadow: activeTab === 'versions' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }
              }, `历史版本 (${state.versions.length})`),
              React.createElement('button', {
                key: 'tab-tests',
                onClick: () => setActiveTab('tests'),
                style: {
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  background: activeTab === 'tests' ? 'var(--dsw-alias-bg-base)' : 'transparent',
                  color: activeTab === 'tests' ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
                  fontWeight: activeTab === 'tests' ? 600 : 400,
                  boxShadow: activeTab === 'tests' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }
              }, `测试验证 (${state.testCases.length})`)
            ])
          ]),

          // 轻量系统通知条（无感淡化）
          statusMsg ? React.createElement('div', {
            key: 'status',
            style: {
              padding: '6px 10px',
              marginBottom: '12px',
              background: 'var(--dsw-alias-bg-layer-2)',
              border: '1px solid var(--dsw-alias-border-l1)',
              borderRadius: '4px',
              fontSize: '12px',
              color: 'var(--dsw-alias-label-secondary)'
            }
          }, statusMsg) : null,

          // 主视图 1：指令编辑区
          activeTab === 'editor' ? React.createElement('div', {
            key: 'view-editor',
            style: { display: 'flex', flexDirection: 'column', gap: '10px' }
          }, [
            // 状态指示行 (类似 VS Code 底部状态栏，低侵入感，严谨展示)
            React.createElement('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                background: 'var(--dsw-alias-bg-layer-2)',
                border: '1px solid var(--dsw-alias-border-l1)',
                borderRadius: '4px',
                fontSize: '11.5px',
                color: 'var(--dsw-alias-label-secondary)'
              }
            }, [
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
                React.createElement('span', null, [
                  'Token: ',
                  React.createElement('strong', { style: { color: 'var(--dsw-alias-label-primary)' } }, String(metrics.tokens))
                ]),
                React.createElement('span', null, `字符: ${metrics.chars}`),
                React.createElement('span', null, `行数: ${metrics.lines}`),
                React.createElement('span', null, `上下文占比: ${metrics.ratio}`)
              ]),
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                hasUnsavedDraft ? React.createElement('span', {
                  style: { color: 'var(--dsw-alias-label-tertiary)' }
                }, '草稿自动保存中') : React.createElement('span', {
                  style: { color: 'var(--dsw-alias-label-tertiary)' }
                }, '与当前版本一致'),
                hasUnsavedDraft ? React.createElement('button', {
                  onClick: handleDiscardDraft,
                  style: {
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--dsw-alias-button-primary-fill, #1f6feb)',
                    fontSize: '11.5px'
                  }
                }, '还原') : null
              ])
            ]),

            // 规则快捷追加栏（去表情符号，纯工程标签）
            React.createElement('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap'
              }
            }, [
              React.createElement('span', {
                style: { fontSize: '11.5px', color: 'var(--dsw-alias-label-tertiary)', flexShrink: 0 }
              }, '预置规则:'),
              ...STANDARD_CONSTRAINTS.map((c, idx) => {
                return React.createElement('button', {
                  key: 'c-' + idx,
                  onClick: () => handleInsertConstraint(c.text),
                  style: {
                    border: '1px solid var(--dsw-alias-border-l1)',
                    background: 'var(--dsw-alias-bg-base)',
                    color: 'var(--dsw-alias-label-secondary)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '11.5px',
                    cursor: 'pointer'
                  }
                }, `+ ${c.label}`);
              })
            ]),

            // 编辑器（深灰色/中性代码框，等宽字体，无花哨装饰）
            React.createElement('textarea', {
              value: currentPrompt,
              onChange: (e) => handlePromptChange(e.target.value),
              placeholder: '输入系统级指导提示词...',
              rows: 15,
              style: {
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid var(--dsw-alias-border-l2)',
                background: 'var(--dsw-alias-bg-base)',
                color: 'var(--dsw-alias-label-primary)',
                fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                fontSize: '12.5px',
                lineHeight: '1.6',
                resize: 'vertical',
                outline: 'none'
              }
            }),

            // 提交面板（表单化布局，类似 Git Commit 区域）
            React.createElement('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                background: 'var(--dsw-alias-bg-layer-2)',
                border: '1px solid var(--dsw-alias-border-l1)',
                borderRadius: '6px',
                marginTop: '4px'
              }
            }, [
              React.createElement('input', {
                type: 'text',
                value: commitName,
                onChange: (e) => setCommitName(e.target.value),
                placeholder: '版本名称 (例如: 2026-Q3 严格规范)',
                style: {
                  width: '200px',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--dsw-alias-border-l2)',
                  background: 'var(--dsw-alias-bg-base)',
                  color: 'var(--dsw-alias-label-primary)',
                  fontSize: '12px',
                  outline: 'none'
                }
              }),
              React.createElement('input', {
                type: 'text',
                value: commitDesc,
                onChange: (e) => setCommitDesc(e.target.value),
                placeholder: '变更说明 (可选)',
                style: {
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--dsw-alias-border-l2)',
                  background: 'var(--dsw-alias-bg-base)',
                  color: 'var(--dsw-alias-label-primary)',
                  fontSize: '12px',
                  outline: 'none'
                }
              }),
              React.createElement('button', {
                onClick: handleCommit,
                style: {
                  padding: '5px 14px',
                  borderRadius: '4px',
                  border: 'none',
                  background: 'var(--dsw-alias-button-primary-fill, #1f6feb)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '12px'
                }
              }, '保存新版本')
            ])
          ]) : null,

          // 主视图 2：版本列表
          activeTab === 'versions' ? React.createElement('div', {
            key: 'view-versions',
            style: { display: 'flex', flexDirection: 'column', gap: '8px' }
          }, [
            state.versions.map(v => {
              const isActive = v.id === state.currentActiveVersionId;
              return React.createElement('div', {
                key: v.id,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: 'var(--dsw-alias-bg-layer-2)',
                  border: isActive ? '1px solid var(--dsw-alias-state-business-primary, #1f6feb)' : '1px solid var(--dsw-alias-border-l1)'
                }
              }, [
                React.createElement('div', { key: 'meta' }, [
                  React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                    React.createElement('strong', { style: { fontSize: '13px' } }, `v${v.version} ${v.name}`),
                    isActive ? React.createElement('span', {
                      style: {
                        fontSize: '10.5px',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: 'var(--dsw-alias-bg-base)',
                        border: '1px solid var(--dsw-alias-border-l2)',
                        color: 'var(--dsw-alias-label-secondary)'
                      }
                    }, '运行中') : null
                  ]),
                  React.createElement('div', {
                    style: { fontSize: '11.5px', color: 'var(--dsw-alias-label-tertiary)', marginTop: '2px' }
                  }, `${v.description} · ${new Date(v.createdAt).toLocaleDateString()}`)
                ]),
                React.createElement('div', { key: 'btn-group', style: { display: 'flex', gap: '6px' } }, [
                  !isActive ? React.createElement('button', {
                    onClick: () => handleActivate(v.id),
                    style: {
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: '1px solid var(--dsw-alias-border-l2)',
                      background: 'var(--dsw-alias-bg-base)',
                      color: 'var(--dsw-alias-label-primary)',
                      cursor: 'pointer',
                      fontSize: '11.5px'
                    }
                  }, '激活') : null,
                  React.createElement('button', {
                    onClick: () => {
                      handlePromptChange(v.systemPrompt);
                      setActiveTab('editor');
                      setStatusMsg(`已载入 v${v.version} 至编辑区`);
                    },
                    style: {
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: '1px solid var(--dsw-alias-border-l2)',
                      background: 'var(--dsw-alias-bg-base)',
                      color: 'var(--dsw-alias-label-primary)',
                      cursor: 'pointer',
                      fontSize: '11.5px'
                    }
                  }, '载入编辑')
                ])
              ]);
            })
          ]) : null,

          // 主视图 3：测试用例验证
          activeTab === 'tests' ? React.createElement('div', {
            key: 'view-tests',
            style: { display: 'flex', flexDirection: 'column', gap: '8px' }
          }, [
            state.testCases.map(tc => {
              return React.createElement('div', {
                key: tc.id,
                style: {
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: 'var(--dsw-alias-bg-layer-2)',
                  border: '1px solid var(--dsw-alias-border-l1)'
                }
              }, [
                React.createElement('div', { style: { fontWeight: 500 } }, tc.title),
                React.createElement('div', {
                  style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', marginTop: '4px' }
                }, tc.inputPrompt)
              ]);
            })
          ]) : null
        ]);
      }

      return module.exports;
    }
  });
}
