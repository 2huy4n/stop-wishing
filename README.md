# stop-wishing

**中文** | [English](README.en.md)

[![test](https://github.com/2huy4n/stop-wishing/actions/workflows/test.yml/badge.svg)](https://github.com/2huy4n/stop-wishing/actions/workflows/test.yml)

治「许愿式编程」的技能包：**用户给一句模糊指令，AI 别急着写码，先对齐目标/边界/验收、先解释、先备份，再最小差异动手。**

仓库现在包含 **7 个并列技能**：主技能负责接需求与交付流程，六个卫星技能分别负责「审查一次改动」「审计整个仓库」「维护技术债台账」「把需求写成 spec 卡」「把 spec 拆成有依赖顺序的票」「初始化项目文档与协作约定」。

| 技能 | 用途 | 何时用 |
|---|---|---|
| [`stop-wishing`](skills/stop-wishing/SKILL.md) | 主技能：澄清、需求卡、许可证闸门、备份、最小差异、证据汇报 | 接到模糊需求、改别人的仓库、引入依赖/字体/图标/API |
| [`stop-wishing-review`](skills/stop-wishing-review/SKILL.md) | 审查一次改动（diff / 分支 / PR）：Intent（有没有做对）+ Engineering（会不会炸，六维 + 12 条坏味道） | 合并前、上线前、让 AI 看一遍 diff |
| [`stop-wishing-audit`](skills/stop-wishing-audit/SKILL.md) | 全仓审计：架构、流程、风险，最多 20 条发现 | 接手陌生项目、做代码体检 |
| [`stop-wishing-debt`](skills/stop-wishing-debt/SKILL.md) | 从 `shortcut:` 注释生成技术债台账 | 规划清理、评估欠了多少债 |
| [`stop-wishing-spec`](skills/stop-wishing-spec/SKILL.md) | 把已确认的需求卡写成带验收标准的 spec 卡，并维护 `card_sha256` 与 `docs/project.md` 的一致性 | 需求谈完、要落成文档时 |
| [`stop-wishing-tickets`](skills/stop-wishing-tickets/SKILL.md) | 把 spec 拆成 tracer-bullet 票，维护 `blocked_by` 依赖 DAG 与状态 | 一个 spec 一次做不完、要排顺序时 |
| [`stop-wishing-setup`](skills/stop-wishing-setup/SKILL.md) | 初始化项目协作约定：票放哪（local/GitHub/其他）、领域术语与 ADR、五角色标签映射；可选维护 `AGENTS.md` 的 `## Project docs` 段 | 接手空仓库、要把流程落到文档时 |

主技能正文为英文（`description` 中英双语，中文触发词保留）。原中文版只保留在本地备份，**不入库**（`*.bak-*` 已被 `.gitignore` 忽略）；如需追溯，见提交 `e428327`。

## 怎么装

安装器会把 `skills/` 下的**七个技能**一起装进目标 skills 根目录：

```bash
# 只看看会复制什么（不写盘）
node install.js --dry-run

# 装到用户级 skills 目录：~/.agents/skills/{stop-wishing,stop-wishing-review,stop-wishing-audit,stop-wishing-debt,stop-wishing-spec,stop-wishing-tickets,stop-wishing-setup}
node install.js --tool dsh --verify

# 同时装给 Claude Code：~/.claude/skills/<七个技能>
node install.js --tool claude --verify

# 自定义 skills 根目录
node install.js --dest /path/to/skills --verify

# 目标已存在、确实要覆盖时才加 --force
node install.js --force
```

`--verify` 会逐个技能校验 `SKILL.md` 存在、front-matter `name` 与目录名一致、与源文件 hash 一致；主技能额外校验 `scripts/` 7 个脚本、`CARD.md` 等 5 个参考文件、`templates/{zh,en}` 各 8 份（7 份文档 + `AGENTS.md.tpl`）、`LICENSE`。

`--force` 升级时会按上一版安装清单（`.install-manifest.json`）删除新版本不再提供的文件（如旧的 `scripts/build-portable.js`），清单之外的用户自建文件不会动。

编辑器适配说明见 [`adapters/`](adapters/)：`claude-code/README.md`、`codex/AGENTS.md`、`trae/README.md`。

## 项目文档与 AGENTS.md（可选）

`init-docs.js` 默认只在 `<项目>/docs/` 生成 7 份文档。加 `--agents-md` 会**额外**在仓库根写一个 `AGENTS.md`，里面只有 5–10 行指针，让任何 agent 一进仓库就先读这些文档：

```bash
node skills/stop-wishing/scripts/init-docs.js --lang zh --dir <项目目录> --agents-md
```

规则：

- **默认不生成**，只有用户明确同意才加这个参数；
- 已存在 `AGENTS.md` 或 `CLAUDE.md` 时**绝不覆盖**，只报告「未生成」；
- 只放指针，不搬正文——它会常驻每次对话，塞多了是负担。

技能本身也会在开头提问时问一次：「要不要放一个 AGENTS.md 指向这些文档？」回答不是明确的「要」，就不写。

## 多工具元数据与版本

- 每个技能自带 `agents/openai.yaml`（`display_name` / `short_description`），Codex 等工具按此显示；`stop-wishing-setup` 额外写 `allow_implicit_invocation: false`，因为它只应在用户明确要求时运行。
- 版本见 `VERSION` 与 `CHANGELOG.md`。版本号不写进 SKILL.md，避免改一次文档就要同步多处。
- 重装到已存在的目录时，安装器不再只报「已存在」：会列出具体哪些文件**缺失**或**落后**；完全一致时提示无需更新。

## 给 AI 看：用户不会装时按此执行

给 claude/gpt/kimi/deepseek/glm/hy/minimax/qwen 或者任何 AI 看：
如果用户不会装 skill 文件，请 AI 参考以下步骤安装本 skill

1. **前置检查**：`node --version` 要求 **≥18**；确认你有目标目录的写权限（写不了走第 6 步，不要硬闯）。
2. **获取文件**：`git clone <本仓库地址>`，或把压缩包解压到临时目录，然后 `cd` 进该目录（能看到 `skills/` 就对了）。
3. **判断目标路径**（先问清用户用的是什么工具）：

   | 用户用的工具 | 目标 skills 根目录 |
   |---|---|
   | DSH / Codex / TRAE | `~/.agents/skills/` |
   | Claude Code | `~/.claude/skills/` |
   | **不确定** | **先问用户「你用的是哪个工具？」**，不要猜 |

   若**无法向用户提问**（无人值守 / 用户已离开），按当前运行环境判断（例如 DSH → `~/.agents/skills`），并在最终报告里写明「**我假设你用的是 X**」；仍不确定时优先装到 `~/.agents/skills`（DSH/Codex/TRAE 三工具共用）。

4. **安装**（`--verify` 会逐个技能自检并打印 PASS/WARN/FAIL）：

   ```bash
   node install.js --tool dsh    --verify   # DSH / Codex / TRAE
   node install.js --tool claude --verify   # Claude Code
   ```

   参数：`--tool` / `--dest` / `--verify` / `--dry-run` / `--force` / `--target`。其中：

   - `--dest <skills 根目录>` = 直接作为 skills 根目录，下面创建 7 个技能子目录；
   - `--target <base>` = **兼容旧用法**，同样把 7 个技能装到 `<base>/stop-wishing{,-review,-audit,-debt,-spec,-tickets,-setup}`。

   `--verify` 逐文件与源做 hash 比对：`[PASS] 齐全且与源一致` / `[WARN] 齐全但内容落后于源（退出码 4，建议加 --force 更新）` / `[FAIL] 缺失或不一致（退出码 3）`。总体退出码：0 成功或 dry-run / 1 参数或覆盖冲突 / 2 源文件缺失 / 3 缺失或不一致 / 4 落后于源。

5. **验证**：目标 skills 根目录下必须有 `stop-wishing/`、`stop-wishing-review/`、`stop-wishing-audit/`、`stop-wishing-debt/`、`stop-wishing-spec/`、`stop-wishing-tickets/`、`stop-wishing-setup/` 七个目录，每个含 `SKILL.md`；主技能另有 `scripts/`（7 个）、`CARD.md` 等 5 个参考文件、`templates/zh` 与 `templates/en`（各 8 份：7 份文档 + `AGENTS.md.tpl`）、`assets/vibe-coding-glossary.html` 与 `assets/en.json`、`LICENSE`。`--verify` 全 PASS 才算装好。

   **术语问答，装好即用**：用户问「MVP 是什么」这类词时，先查 `<skills 根>/stop-wishing/assets/vibe-coding-glossary.html` 中的 `zh:'<词>'` 或 `en:'<词>'`，用该词条的 `d`/`de` 解释、`a`/`ae` 打比方，并附 `#term-<slug>` 深链（slug = 英文名小写、非字母数字转 `-`）；本地没有这个词再联网搜索。不要自动弹浏览器，也不要把整份词表贴出来。
6. **失败处理**：若写入被沙箱/权限拒绝，**不要反复重试**，直接告诉用户「需要你手动执行」，并给出可直接复制的命令：

   ```bash
   # macOS / Linux
   mkdir -p ~/.agents/skills
   cp -R skills/stop-wishing         ~/.agents/skills/stop-wishing
   cp -R skills/stop-wishing-review  ~/.agents/skills/stop-wishing-review
   cp -R skills/stop-wishing-audit   ~/.agents/skills/stop-wishing-audit
   cp -R skills/stop-wishing-debt    ~/.agents/skills/stop-wishing-debt
   cp -R skills/stop-wishing-spec    ~/.agents/skills/stop-wishing-spec
   cp -R skills/stop-wishing-tickets ~/.agents/skills/stop-wishing-tickets
   cp -R skills/stop-wishing-setup   ~/.agents/skills/stop-wishing-setup

   # Windows PowerShell
   New-Item -ItemType Directory -Force "$env:USERPROFILE\.agents\skills" | Out-Null
   Copy-Item skills\stop-wishing* "$env:USERPROFILE\.agents\skills\" -Recurse
   ```

7. **装完告诉用户怎么触发**：输入 `/stop-wishing`，或直接说「用 stop-wishing 流程」（也可说「先解释再写码」「改动前备份」等触发词）。审查/审计/债务/写规格/拆票/初始化分别用 `/stop-wishing-review`、`/stop-wishing-audit`、`/stop-wishing-debt`、`/stop-wishing-spec`、`/stop-wishing-tickets`、`/stop-wishing-setup`。

## 脚本（零第三方依赖）

| 脚本 | 用途 | 退出码 |
|---|---|---|
| `skills/stop-wishing/scripts/check-env.js` | 探测 git/bash/node/是否 git 仓库，输出 JSON + 备份建议 | 0 就绪 / 1 缺关键项 |
| `skills/stop-wishing/scripts/init-docs.js` | 从 `templates/<lang>/` 生成 7 份项目文档（含 `LICENSES.md` 与进度快照） | 0 成功 / 1 参数错误或已存在 / 2 模板缺失 |
| `skills/stop-wishing/scripts/check-hardcode.js` | 扫绝对路径/密钥/URL/端口/魔法数字（支持 `.hardcodeignore`） | 0 干净或全部被抑制 / 2 有未抑制命中或忽略文件非法 |
| `skills/stop-wishing/scripts/check-licenses.js` | 扫 `package-lock.json`（`lockfileVersion` ≥ 2，含传递/嵌套依赖）与 `node_modules`（补许可证字段），解析 SPDX（`OR`/`AND`/`WITH`），按 `LICENSE.md` 的用途矩阵判定；参数 `--use self\|free-closed\|open-source\|commercial`、`--prod-only`、`--strict`、`--json`、`--rows` | 0 无禁止项（可有 `warn`/`unknown` 警告） / 1 有禁止项或 `--strict` 下未知 / 2 参数或 IO |
| `skills/stop-wishing/scripts/check-tickets.js` | 校验 `docs/tickets/*.md`（并对照 `docs/specs/`、`docs/project.md`）：E1–E13 错误 + W1–W5 警告 | 0 无错误（可有警告）/ 1 有错误 / 2 用法或 IO |
| `skills/stop-wishing/scripts/setup.js` | 生成/更新 `docs/agents/{issue-tracker,domain,triage-labels}.md`（只动标记段、幂等；`--issue-tracker local` 指向 `docs/issues/`，与工作计划目录 `docs/tickets/` 分开），可选维护既有 `AGENTS.md`/`CLAUDE.md` 的 `## Project docs` 段（**绝不创建**它们） | 0 成功（含 unchanged）/ 1 参数错误 / 2 IO 错误 |
| `skills/stop-wishing/scripts/preflight.js` | 一次跑完环境、硬编码、依赖许可三项预检（无 lock/node_modules 时许可证标记为跳过） | 0 通过 / 1 有阻断项 / 2 用法或 IO |

`check-tickets.js` 的检查项：E1 front-matter 解析、E2 必填字段（id/title/spec/status/acceptance/verify）、E3 文件名、E4 id 与文件名前缀、E5 id 重复、E6 status、E7 spec 不存在、E8 blocked_by 指向不存在的票、E9 自依赖、E10 成环、E11 验收为空、E12 verify 为空或少于验收条数、E13 done/dropped 仍被依赖；警告：W1 缺 estimate、W2 验收超过 5 条、W3 verify 全不可执行、W4 spec 的 `card_sha256` 与 `docs/project.md` 不一致、W5 spec 未被任何票引用。

```bash
node skills/stop-wishing/scripts/check-tickets.js --dir <项目根> [--json]
# 0 = 无错误（警告不影响退出码）；1 = 有错误；2 = 用法或 IO 错误

node skills/stop-wishing/scripts/setup.js --dir <项目根> \
  [--issue-tracker local|github|other] [--labels default|none] [--layout single|multi] \
  [--agents-md] [--dry-run] [--json]
# 0 = 成功（含 unchanged）；1 = 参数错误；2 = IO 错误
```

## 附赠：Vibe Coding 名词速查表

[`skills/stop-wishing/assets/vibe-coding-glossary.html`](skills/stop-wishing/assets/vibe-coding-glossary.html) 是给零基础用户的 **147 词**速查表：9 个分类、10 组易混词、5 个常见坑；支持「按场景查」（改页面 / 装依赖 / 部署上线 / 报错了），每条标了「必记」或「进阶」。**每个词都有中文解释 + 英文对照**（定义与比方各一行），中英文和报错代码都能搜。

它**随技能一起安装**到 `<skills 根>/stop-wishing/assets/`，离线可用、版本与技能一致；也可以直接在仓库里打开。装好之后，AI 遇到术语问题会先查这份本地词表（见上文「给 AI 看」第 5 步）。

## 许可证

本仓库自身以 **AGPL-3.0-or-later**（GNU Affero General Public License v3.0 或更高版本）发布，全文见仓库根目录的 [`LICENSE`](LICENSE)。

- 你可以按 AGPL 条款**使用、修改、再分发**；
- 分发修改版时需保留同样的许可证与版权声明；若把它作为网络服务提供给别人使用，AGPL 第 13 条要求向使用者提供对应源码；
- 主技能另外**要求使用者在引入任何外部东西之前**过一遍许可证闸门（代码依赖、字体、图标/图片、第三方 API 条款、模板片段），并把结论写进项目里的 `docs/LICENSES.md`。
- 仓库里已有 `node_modules/` 或 `package-lock.json` 时，先跑 `node skills/stop-wishing/scripts/check-licenses.js --use <self|free-closed|open-source|commercial>`：它优先读 `package-lock.json`（含传递/嵌套依赖），按 §7 的用途矩阵逐个依赖体检；退出码 0 = 无禁止项，1 = 有禁止项或 `--strict` 下的未知项，2 = 参数或 IO。`forbidden` 阻断改动，`warn` 记录后人工确认，`unknown` 写进 `docs/LICENSES.md` 标未核验；扫描器只读包元数据，自定义/商业条款仍要人工读。

## Credits

`stop-wishing` 的部分内容改写并合并自 MIT 许可的 **ponytail**（Copyright (c) 2026 DietrichGebert）。完整 MIT 文本与归属说明见 [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)。
