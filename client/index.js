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
            label: () => '提示词演进 ⚡',
            icon: 'sliders'
          }, (props) => {
            return React.createElement(PromptStudioView, { ctx, React });
          });
        });
      };

      // 模块化 Token 透视与统计引擎
      function analyzeTextMetrics(text) {
        if (!text || text.length === 0) {
          return {
            tokens: 0,
            chars: 0,
            words: 0,
            lines: 0,
            zhChars: 0,
            enWords: 0,
            contextRatio: 0
          };
        }

        const lines = text.split('\n').length;
        const chars = text.length;

        // 统计中文字符数（CJK 统一表意文字）
        const zhMatches = text.match(/[\u4e00-\u9fa5]/g);
        const zhChars = zhMatches ? zhMatches.length : 0;

        // 统计纯英文单词数
        const enMatches = text.match(/[a-zA-Z0-9_-]+/g);
        const enWords = enMatches ? enMatches.length : 0;

        // 更加精准的 Token 估算模型：
        // 中文通常每个字约 0.6~0.75 token（现代 BPE 分词器），英文单词约为 1.25~1.3 token，标点/换行按比例折算
        const estimatedTokens = Math.max(
          1,
          Math.round(zhChars * 0.72 + enWords * 1.3 + (chars - zhChars) * 0.15)
        );

        // 默认按 64k (65536) 典型工作上下文窗口计算占用率百分比
        const contextRatio = ((estimatedTokens / 65536) * 100).toFixed(2);

        return {
          tokens: estimatedTokens,
          chars,
          words: zhChars + enWords,
          lines,
          zhChars,
          enWords,
          contextRatio
        };
      }

      // 预置常用专业提示词片段 (Snippets)
      const PROMPT_SNIPPETS = [
        {
          label: '🔒 严禁生成 TODO/未完成占位',
          snippet: '\n\n【开发约束】严禁输出任何形式的 TODO、未完待续或省略号占位符，所有函数与逻辑必须提供完整可运行的实现。'
        },
        {
          label: '🛡️ 严格类型与类型安全 (TypeScript)',
          snippet: '\n\n【类型规范】所有代码必须具备严格的 TypeScript 类型声明，严禁滥用 any，复杂数据结构必须显式定义 interface。'
        },
        {
          label: '⚡ 极简精准输出 (Token 节省)',
          snippet: '\n\n【沟通风格】直接提供核心代码和关键差异解释，去除所有不必要的开场客套话与结尾总结，优先节省上下文空间。'
        },
        {
          label: '🧪 测试用例优先原则 (TDD)',
          snippet: '\n\n【质量要求】每次编写或重构业务逻辑后，必须自动随附一组覆盖边界情况的自动化单元测试代码。'
        }
      ];

      function PromptStudioView({ ctx, React }) {
        const [state, setState] = React.useState(null);
        const [activeTab, setActiveTab] = React.useState('editor');
        const [currentPrompt, setCurrentPrompt] = React.useState('');
        const [commitName, setCommitName] = React.useState('');
        const [commitDesc, setCommitDesc] = React.useState('');
        const [evalLoading, setEvalLoading] = React.useState(false);
        const [statusMsg, setStatusMsg] = React.useState('');
        const [hasUnsavedDraft, setHasUnsavedDraft] = React.useState(false);

        const AUTOSAVE_KEY = 'dsh_prompt_studio_draft_v1';

        // 实时高精度指标计算
        const metrics = React.useMemo(() => {
          return analyzeTextMetrics(currentPrompt);
        }, [currentPrompt]);

        // 读取服务端数据或本地草稿
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
            console.warn('[PromptStudio] Fetch failed, fallback to local baseline:', e);
            fallbackState();
          }
        };

        const initPromptDraft = (data) => {
          // 优先检查 LocalStorage 是否有未保存的编辑草稿
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
              name: '基础编码架构师',
              description: 'DeepSeek Harness 官方默认的高性能编码指令基线',
              systemPrompt: '你是由 DeepSeek Harness 驱动的高级软件架构师与开发专家。始终提供简洁高效、强类型约束且易于维护的代码方案。',
              createdAt: Date.now(),
              metrics: { tokenCount: 28 }
            }],
            testCases: [
              {
                id: 'tc-lru',
                title: 'LRU 缓存算法实现',
                category: 'coding',
                inputPrompt: '请用 TypeScript 实现一个标准的高效 LRU Cache 类，包含 get 与 put 方法，复杂度必须为 O(1)。'
              }
            ],
            evalResults: []
          };
          setState(defaultData);
          initPromptDraft(defaultData);
        };

        React.useEffect(() => {
          refreshState();
        }, []);

        // 草稿实时自动落盘保存 (AutoSave)
        const handlePromptChange = (val) => {
          setCurrentPrompt(val);
          setHasUnsavedDraft(true);
          try {
            localStorage.setItem(AUTOSAVE_KEY, val);
          } catch (err) {
            console.error('Failed to autosave draft:', err);
          }
        };

        // 插入常用提示词片段
        const handleInsertSnippet = (snippet) => {
          const newText = (currentPrompt + snippet).trim();
          handlePromptChange(newText);
          setStatusMsg('✨ 已成功追加提示词工程模块！');
        };

        // 丢弃本地草稿恢复为活跃版本
        const handleDiscardDraft = () => {
          localStorage.removeItem(AUTOSAVE_KEY);
          setHasUnsavedDraft(false);
          if (state && state.versions) {
            const active = state.versions.find(v => v.id === state.currentActiveVersionId) || state.versions[0];
            if (active) setCurrentPrompt(active.systemPrompt);
          }
          setStatusMsg('🔄 已还原为当前激活的版本内容。');
        };

        // 提交为新快照
        const handleCommit = async () => {
          if (!commitName.trim() || !currentPrompt.trim()) {
            setStatusMsg('⚠️ 请输入版本标题，且提示词内容不能为空。');
            return;
          }
          try {
            await fetch('/api/dsh-prompt-studio/commit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: commitName,
                description: commitDesc || '通过提示词工作台快速迭代',
                systemPrompt: currentPrompt,
                tags: ['studio']
              })
            });
            // 提交成功后清除未保存标记与本地自动保存缓存
            localStorage.removeItem(AUTOSAVE_KEY);
            setHasUnsavedDraft(false);
            setCommitName('');
            setCommitDesc('');
            setStatusMsg('✅ 恭喜！新提示词版本已成功打上快照并保存至时间线！');
            await refreshState();
          } catch (err) {
            setStatusMsg('❌ 提交新版本失败: ' + err.message);
          }
        };

        const handleActivate = async (versionId) => {
          try {
            await fetch('/api/dsh-prompt-studio/activate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ versionId })
            });
            setStatusMsg('🚀 已成功无缝切换当前生效的系统提示词！');
            await refreshState();
          } catch (err) {
            setStatusMsg('❌ 切换版本失败: ' + err.message);
          }
        };

        if (!state) {
          return React.createElement('div', {
            style: { padding: '24px', color: 'var(--dsw-alias-label-secondary)' }
          }, '正在加载提示词演进工作台...');
        }

        const activeVersion = state.versions.find(v => v.id === state.currentActiveVersionId) || state.versions[0];

        return React.createElement('div', {
          style: {
            padding: '20px 24px',
            maxWidth: '1080px',
            margin: '0 auto',
            fontFamily: 'var(--dsw-font-family, system-ui, -apple-system, sans-serif)',
            color: 'var(--dsw-alias-label-primary)'
          }
        }, [
          // 顶部标题栏
          React.createElement('div', {
            key: 'header',
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              borderBottom: '1px solid var(--dsw-alias-border-l2)',
              paddingBottom: '14px'
            }
          }, [
            React.createElement('div', { key: 'title-box' }, [
              React.createElement('h2', {
                style: {
                  margin: 0,
                  fontSize: '19px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: 'var(--dsw-alias-label-primary)'
                }
              }, [
                '提示词演进工作台',
                React.createElement('span', {
                  style: {
                    fontSize: '11.5px',
                    background: 'var(--dsw-alias-state-success-primary, #238636)',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: 500
                  }
                }, `生效中: v${activeVersion ? activeVersion.version : 1}`)
              ]),
              React.createElement('p', {
                style: { margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--dsw-alias-label-tertiary)' }
              }, '高精度 Token 透视分析 · Git 式快照回滚 · 自动化质量测试')
            ]),
            // Tab 切换导航
            React.createElement('div', {
              key: 'tabs',
              style: {
                display: 'flex',
                gap: '4px',
                background: 'var(--dsw-alias-bg-layer-2)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid var(--dsw-alias-border-l1)'
              }
            }, [
              React.createElement('button', {
                key: 'tab-edit',
                onClick: () => setActiveTab('editor'),
                style: {
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'editor' ? 'var(--dsw-alias-button-primary-fill, #1f6feb)' : 'transparent',
                  color: activeTab === 'editor' ? '#fff' : 'var(--dsw-alias-label-secondary)',
                  fontWeight: activeTab === 'editor' ? 600 : 500,
                  fontSize: '12px'
                }
              }, '📝 提示词起草区'),
              React.createElement('button', {
                key: 'tab-versions',
                onClick: () => setActiveTab('versions'),
                style: {
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'versions' ? 'var(--dsw-alias-button-primary-fill, #1f6feb)' : 'transparent',
                  color: activeTab === 'versions' ? '#fff' : 'var(--dsw-alias-label-secondary)',
                  fontWeight: activeTab === 'versions' ? 600 : 500,
                  fontSize: '12px'
                }
              }, `⏳ 版本历史 (${state.versions.length})`),
              React.createElement('button', {
                key: 'tab-eval',
                onClick: () => setActiveTab('benchmark'),
                style: {
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'benchmark' ? 'var(--dsw-alias-button-primary-fill, #1f6feb)' : 'transparent',
                  color: activeTab === 'benchmark' ? '#fff' : 'var(--dsw-alias-label-secondary)',
                  fontWeight: activeTab === 'benchmark' ? 600 : 500,
                  fontSize: '12px'
                }
              }, `🎯 金标评测 (${state.testCases.length})`)
            ])
          ]),

          // 状态横幅
          statusMsg ? React.createElement('div', {
            key: 'status',
            style: {
              padding: '8px 12px',
              marginBottom: '14px',
              background: 'var(--dsw-alias-bg-layer-2)',
              border: '1px solid var(--dsw-alias-border-l1)',
              borderRadius: '6px',
              fontSize: '12.5px',
              color: 'var(--dsw-alias-label-primary)'
            }
          }, statusMsg) : null,

          // ======================== 功能 1：核心起草区与实时 Token 透视 ========================
          activeTab === 'editor' ? React.createElement('div', { key: 'tab-content-editor' }, [
            // 实时指标透视仪表盘 (Token 透视卡片群)
            React.createElement('div', {
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px',
                marginBottom: '14px'
              }
            }, [
              // 卡片 1: 预估 Token
              React.createElement('div', {
                key: 'm-token',
                style: {
                  padding: '10px 14px',
                  background: 'var(--dsw-alias-bg-layer-2)',
                  border: '1px solid var(--dsw-alias-border-l1)',
                  borderRadius: '8px'
                }
              }, [
                React.createElement('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' } }, '预估消耗 Token'),
                React.createElement('div', {
                  style: {
                    fontSize: '20px',
                    fontWeight: 700,
                    marginTop: '2px',
                    color: metrics.tokens > 1500 ? 'var(--dsw-alias-state-warn-primary, #e3b341)' : 'var(--dsw-alias-state-success-primary, #3fb950)'
                  }
                }, `~${metrics.tokens}`),
                React.createElement('div', { style: { fontSize: '10.5px', color: 'var(--dsw-alias-label-tertiary)', marginTop: '2px' } }, `占 64k 窗口 ${metrics.contextRatio}%`)
              ]),
              // 卡片 2: 总字符数与中英构成
              React.createElement('div', {
                key: 'm-chars',
                style: {
                  padding: '10px 14px',
                  background: 'var(--dsw-alias-bg-layer-2)',
                  border: '1px solid var(--dsw-alias-border-l1)',
                  borderRadius: '8px'
                }
              }, [
                React.createElement('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' } }, '字符总数'),
                React.createElement('div', {
                  style: { fontSize: '20px', fontWeight: 700, marginTop: '2px', color: 'var(--dsw-alias-label-primary)' }
                }, `${metrics.chars}`),
                React.createElement('div', { style: { fontSize: '10.5px', color: 'var(--dsw-alias-label-tertiary)', marginTop: '2px' } }, `中文 ${metrics.zhChars} 字 · 英文 ${metrics.enWords} 词`)
              ]),
              // 卡片 3: 行数与排版密度
              React.createElement('div', {
                key: 'm-lines',
                style: {
                  padding: '10px 14px',
                  background: 'var(--dsw-alias-bg-layer-2)',
                  border: '1px solid var(--dsw-alias-border-l1)',
                  borderRadius: '8px'
                }
              }, [
                React.createElement('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' } }, '指令行数'),
                React.createElement('div', {
                  style: { fontSize: '20px', fontWeight: 700, marginTop: '2px', color: 'var(--dsw-alias-label-primary)' }
                }, `${metrics.lines}`),
                React.createElement('div', { style: { fontSize: '10.5px', color: 'var(--dsw-alias-label-tertiary)', marginTop: '2px' } }, '结构化段落分明')
              ]),
              // 卡片 4: 自动保存状态
              React.createElement('div', {
                key: 'm-save',
                style: {
                  padding: '10px 14px',
                  background: 'var(--dsw-alias-bg-layer-2)',
                  border: '1px solid var(--dsw-alias-border-l1)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }
              }, [
                React.createElement('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' } }, '本地存储状态'),
                React.createElement('div', {
                  style: {
                    fontSize: '13px',
                    fontWeight: 600,
                    marginTop: '4px',
                    color: hasUnsavedDraft ? 'var(--dsw-alias-state-warn-primary, #e3b341)' : 'var(--dsw-alias-state-success-primary, #3fb950)'
                  }
                }, hasUnsavedDraft ? '● 有未提交草稿 (已实时保存)' : '✓ 已与当前版本同步'),
                hasUnsavedDraft ? React.createElement('button', {
                  onClick: handleDiscardDraft,
                  style: {
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--dsw-alias-button-primary-fill, #1f6feb)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: 0,
                    marginTop: '2px'
                  }
                }, '还原为基线') : null
              ])
            ]),

            // 快捷模块注入条 (Snippets Quick Bar)
            React.createElement('div', {
              style: {
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap'
              }
            }, [
              React.createElement('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', flexShrink: 0 } }, '⚡ 快速插入规范模块:'),
              ...PROMPT_SNIPPETS.map((snip, idx) => {
                return React.createElement('button', {
                  key: 'snip-' + idx,
                  onClick: () => handleInsertSnippet(snip.snippet),
                  style: {
                    padding: '3px 9px',
                    fontSize: '11.5px',
                    background: 'var(--dsw-alias-bg-layer-2)',
                    border: '1px solid var(--dsw-alias-border-l2)',
                    color: 'var(--dsw-alias-label-secondary)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }
                }, snip.label);
              })
            ]),

            // 核心起草输入区域
            React.createElement('div', { style: { position: 'relative' } }, [
              React.createElement('textarea', {
                value: currentPrompt,
                onChange: (e) => handlePromptChange(e.target.value),
                placeholder: '在此输入或微调你的 Agent 系统级提示词 (实时计算 Token，改动自动落盘保存)...',
                rows: 14,
                style: {
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '14px',
                  borderRadius: '8px',
                  background: 'var(--dsw-specific-input-major, var(--dsw-alias-bg-layer-2))',
                  border: '1px solid var(--dsw-alias-border-l2)',
                  color: 'var(--dsw-alias-label-primary)',
                  fontSize: '13.5px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  resize: 'vertical',
                  outline: 'none',
                  lineHeight: '1.6'
                }
              })
            ]),

            // 提交创建快照卡片
            React.createElement('div', {
              style: {
                marginTop: '14px',
                padding: '14px 16px',
                background: 'var(--dsw-alias-bg-layer-2)',
                borderRadius: '8px',
                border: '1px solid var(--dsw-alias-border-l1)'
              }
            }, [
              React.createElement('div', {
                style: { fontSize: '13.5px', fontWeight: 600, marginBottom: '10px', color: 'var(--dsw-alias-label-primary)' }
              }, '💾 保存为不可变版本快照 (Version Commit)'),
              React.createElement('div', { style: { display: 'flex', gap: '10px', marginBottom: '10px' } }, [
                React.createElement('input', {
                  type: 'text',
                  value: commitName,
                  onChange: (e) => setCommitName(e.target.value),
                  placeholder: '版本名称 (例如: 严谨 TypeScript 模式 / 极简高响应风格)',
                  style: {
                    flex: 1,
                    padding: '7px 10px',
                    background: 'var(--dsw-specific-input-major, var(--dsw-alias-bg-base))',
                    border: '1px solid var(--dsw-alias-border-l2)',
                    color: 'var(--dsw-alias-label-primary)',
                    borderRadius: '6px',
                    fontSize: '12.5px'
                  }
                }),
                React.createElement('input', {
                  type: 'text',
                  value: commitDesc,
                  onChange: (e) => setCommitDesc(e.target.value),
                  placeholder: '改动目的或说明 (可选，便于在时光机中追溯)',
                  style: {
                    flex: 2,
                    padding: '7px 10px',
                    background: 'var(--dsw-specific-input-major, var(--dsw-alias-bg-base))',
                    border: '1px solid var(--dsw-alias-border-l2)',
                    color: 'var(--dsw-alias-label-primary)',
                    borderRadius: '6px',
                    fontSize: '12.5px'
                  }
                })
              ]),
              React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                React.createElement('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' } }, '快照将持久化保存，随时支持一键回滚'),
                React.createElement('button', {
                  onClick: handleCommit,
                  style: {
                    padding: '7px 16px',
                    background: 'var(--dsw-alias-state-success-primary, #238636)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '12.5px'
                  }
                }, '提交快照版本')
              ])
            ])
          ]) : null,

          // 视图 2：版本历史时光机
          activeTab === 'versions' ? React.createElement('div', { key: 'tab-content-versions' }, [
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
              state.versions.map(v => {
                const isActive = v.id === state.currentActiveVersionId;
                return React.createElement('div', {
                  key: v.id,
                  style: {
                    padding: '14px 16px',
                    borderRadius: '8px',
                    background: 'var(--dsw-alias-bg-layer-2)',
                    border: isActive ? '1.5px solid var(--dsw-alias-state-success-primary)' : '1px solid var(--dsw-alias-border-l1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }
                }, [
                  React.createElement('div', { key: 'info' }, [
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                      React.createElement('strong', {
                        style: { fontSize: '14.5px', color: 'var(--dsw-alias-label-primary)' }
                      }, `v${v.version} · ${v.name}`),
                      isActive ? React.createElement('span', {
                        style: {
                          background: 'var(--dsw-alias-state-success-primary, #238636)',
                          color: '#fff',
                          fontSize: '11px',
                          padding: '1px 8px',
                          borderRadius: '10px'
                        }
                      }, '当前生效中') : null
                    ]),
                    React.createElement('p', {
                      style: { margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--dsw-alias-label-secondary)' }
                    }, v.description),
                    React.createElement('div', {
                      style: { marginTop: '6px', fontSize: '11.5px', color: 'var(--dsw-alias-label-tertiary)' }
                    }, [
                      `创建时间: ${new Date(v.createdAt).toLocaleString()} · 预估 Token: ~${v.metrics ? v.metrics.tokenCount : 'N/A'}`
                    ])
                  ]),
                  React.createElement('div', { key: 'actions', style: { display: 'flex', gap: '8px' } }, [
                    !isActive ? React.createElement('button', {
                      onClick: () => handleActivate(v.id),
                      style: {
                        padding: '6px 12px',
                        background: 'var(--dsw-alias-button-primary-fill, #1f6feb)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 500
                      }
                    }, '⚡ 回滚并生效') : null,
                    React.createElement('button', {
                      onClick: () => {
                        handlePromptChange(v.systemPrompt);
                        setActiveTab('editor');
                        setStatusMsg(`已将 v${v.version} 的提示词加载至草稿起草区。`);
                      },
                      style: {
                        padding: '6px 12px',
                        background: 'transparent',
                        color: 'var(--dsw-alias-label-primary)',
                        border: '1px solid var(--dsw-alias-border-l2)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }
                    }, '载入草稿')
                  ])
                ]);
              })
            )
          ]) : null,

          // 视图 3：金标评测集
          activeTab === 'benchmark' ? React.createElement('div', { key: 'tab-content-eval' }, [
            React.createElement('div', {
              style: { marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
            }, [
              React.createElement('h3', {
                style: { margin: 0, fontSize: '15px', color: 'var(--dsw-alias-label-primary)' }
              }, '🎯 金标自动化回归基准集 (Golden Bench)'),
              React.createElement('span', {
                style: { fontSize: '12.5px', color: 'var(--dsw-alias-label-tertiary)' }
              }, `当前目标版本: v${activeVersion ? activeVersion.version : 1}`)
            ]),
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
              state.testCases.map(tc => {
                return React.createElement('div', {
                  key: tc.id,
                  style: {
                    padding: '14px 16px',
                    background: 'var(--dsw-alias-bg-layer-2)',
                    border: '1px solid var(--dsw-alias-border-l1)',
                    borderRadius: '8px'
                  }
                }, [
                  React.createElement('div', {
                    style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
                  }, [
                    React.createElement('div', null, [
                      React.createElement('strong', {
                        style: { fontSize: '14px', color: 'var(--dsw-alias-label-primary)' }
                      }, tc.title),
                      React.createElement('span', {
                        style: {
                          marginLeft: '8px',
                          fontSize: '11px',
                          background: 'var(--dsw-alias-bg-base)',
                          border: '1px solid var(--dsw-alias-border-l2)',
                          color: 'var(--dsw-alias-label-secondary)',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }
                      }, tc.category === 'coding' ? '编码能力' : '安全边界')
                    ])
                  ]),
                  React.createElement('p', {
                    style: { margin: '6px 0 0 0', fontSize: '12.5px', color: 'var(--dsw-alias-label-secondary)' }
                  }, `测试用例输入: "${tc.inputPrompt}"`)
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
