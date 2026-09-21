# dsh-prompt-studio ⚡

<p align="center">
  <b>Prompt & Agent Preset Evolution Studio for DeepSeek Harness</b><br>
  Git-style versioning, timeline diff, golden test bench, and one-click regression evaluation.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-prompt-studio"><img src="https://img.shields.io/badge/npm-dsh--prompt--studio-blue.svg" alt="npm"></a>
  <a href="https://github.com/awesome-dsh-plugin/awesome-dsh-plugin"><img src="https://awesome-dsh-plugin.com/badge.svg" alt="awesome · DSH plugin"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="license"></a>
</p>

English | [简体中文](#简体中文)

---

## What is it?

Fine-tuning your agent's system prompt or skills is often an intuitive gamble: *“Did this change actually improve reasoning, or did it break formatting and safety?”*

`dsh-prompt-studio` brings **professional prompt engineering & regression evaluation** directly into the DeepSeek Harness Web GUI:
- 📝 **Live Prompt Editor & Draft Workspace**: Real-time token counter and syntax-friendly editing.
- ⏳ **Git-Style Version Timeline**: Every change is snapshot with commit message, timestamp, and one-click rollback.
- 🎯 **Golden Test Regression Bench**: Pre-configured test cases (Coding, Reasoning, Refactor, Safety). Evaluate prompt performance objectively with scoring and latency feedback before deploying to production.
- 🔄 **Dynamic Cordis Injection**: Seamlessly injects the currently activated prompt version into the agent's system instruction chain without restarting the host.

---

## Installation

### From DSH Market (One-click)
Open **Settings → Plugin Market**, search for `dsh-prompt-studio` and click **Install**.

### From CLI
```sh
dsh plugin --profile web add dsh-prompt-studio
```

---

## Quick Tour

1. Open **Settings → Prompt Studio ⚡**.
2. Edit your system instructions in the **Prompt Editor** and click **Commit & Create Snapshot**.
3. Go to the **Golden Bench** tab, run regression tests against standard coding & safety prompts.
4. If a newer prompt introduces regressions, switch to **Version History** and click **Rollback to This** to restore the previous stable baseline in milliseconds.

---

<h2 id="简体中文">简体中文说明</h2>

## 它是什么？

在开发或微调 AI Agent 时，修改 System Prompt / 预设规则常常像“玄学开盲盒”——改了之后到底有没有变聪明？是不是反而破坏了代码格式或安全性？

`dsh-prompt-studio` 是为 **DeepSeek Harness** 打造的**提示词与智能体预设演进工作台**，填补了 DSH 生态在 Prompt 工程化管理与自动化回归评测上的空白：
- 📝 **实时提示词起草区**：内置 Token 估算、说明草稿实时预览。
- ⏳ **Git 式版本时光机**：每次改动打 Tag、记录变更原因与时间戳，支持毫秒级一键回滚。
- 🎯 **金标回归测试集 (Golden Bench)**：预置编码、推理、重构、安全边界等多维度测试用例，一键自动化评分（0~100）与耗时统计，彻底告别玄学微调。
- 🔄 **非侵入式 Cordis 动态热注入**：无需重启 DSH 宿主，随时切换当前全局或会话生效的提示词版本。

---

## 提交到官方市场规范 (How to Submit)

在将本仓库推送到 GitHub 并发布到 npm 后：
1. Fork [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)。
2. 在其 `plugins.json` 中追加本项目条目：
```json
{
  "name": "dsh-prompt-studio",
  "owner": "ElioChen240",
  "url": "https://github.com/ElioChen240/dsh-prompt-studio",
  "category": "dev",
  "description": {
    "en": "Prompt & Agent Preset Evolution Studio for DeepSeek Harness: Git-style versioning, diff timeline, and golden test regression bench.",
    "zh": "DSH 提示词与预设演进工作台：Git 式版本化管理、时光机 Diff、金标测试集与一键回归评测。"
  },
  "npm": "dsh-prompt-studio",
  "install": "dsh plugin --profile web add dsh-prompt-studio"
}
```
3. 提交 PR，审核合并后 24 小时内全网 [dsh-market](https://github.com/dsh-market/dsh-market) 客户端均可一键搜索安装。

---

## License
MIT © 2026
