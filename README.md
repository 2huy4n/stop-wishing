# stop-wishing

治「许愿式编程」的技能包：**用户给一句模糊指令，AI 别急着写码，先对齐目标/边界/验收、先解释、先备份，再最小差异动手。**

仓库现在包含 **4 个并列技能**：主技能负责接需求与交付流程，三个卫星技能分别负责「审查一次改动」「审计整个仓库」「维护技术债台账」。

| 技能 | 用途 | 何时用 |
|---|---|---|
| [`stop-wishing`](skills/stop-wishing/SKILL.md) | 主技能：澄清、需求卡、许可证闸门、备份、最小差异、证据汇报 | 接到模糊需求、改别人的仓库、引入依赖/字体/图标/API |
| [`stop-wishing-review`](skills/stop-wishing-review/SKILL.md) | 审查一次改动（diff / 分支 / PR），六维检查 | 合并前、上线前、让 AI 看一遍 diff |
| [`stop-wishing-audit`](skills/stop-wishing-audit/SKILL.md) | 全仓审计：架构、流程、风险，最多 20 条发现 | 接手陌生项目、做代码体检 |
| [`stop-wishing-debt`](skills/stop-wishing-debt/SKILL.md) | 从 `shortcut:` 注释生成技术债台账 | 规划清理、评估欠了多少债 |

主技能正文为英文（`description` 中英双语，中文触发词保留），原中文版备份在 `skills/stop-wishing/SKILL.md.bak-20261023-1220`（已被 `.gitignore` 忽略）。

## 怎么装

安装器会把 `skills/` 下的**四个技能**一起装进目标 skills 根目录：

```bash
# 只看看会复制什么（不写盘）
node install.js --dry-run

# 装到用户级 skills 目录：~/.agents/skills/{stop-wishing,stop-wishing-review,stop-wishing-audit,stop-wishing-debt}
node install.js --tool dsh --verify

# 同时装给 Claude Code：~/.claude/skills/<四个技能>
node install.js --tool claude --verify

# 自定义 skills 根目录
node install.js --dest /path/to/skills --verify

# 目标已存在、确实要覆盖时才加 --force
node install.js --force
```

`--verify` 会逐个技能校验 `SKILL.md` 存在、front-matter `name` 与目录名一致、与源文件 hash 一致；主技能额外校验 `scripts/` 4 个脚本、`templates/{zh,en}` 各 7 份、`LICENSE`。

编辑器适配说明见 [`adapters/`](adapters/)：`claude-code/README.md`、`codex/AGENTS.md`、`trae/README.md`。

## 目录说明

```text
stop-wishing/
├── skills/
│   ├── stop-wishing/                 # 主技能
│   │   ├── SKILL.md                  # 英文正文（17 章）
│   │   ├── SKILL.md.bak-20261023-1220# 原中文版备份（git 忽略）
│   │   ├── scripts/
│   │   │   ├── check-env.js          # git/bash/node/仓库探测 → JSON + 备份建议
│   │   │   ├── init-docs.js          # 生成 7 份项目文档到 <dir>/docs/
│   │   │   ├── check-hardcode.js     # 硬编码扫描（支持 .hardcodeignore）
│   │   │   └── build-portable.js     # 生成 portable/stop-wishing.md
│   │   └── templates/{zh,en}/        # 7 份项目文档模板
│   ├── stop-wishing-review/SKILL.md  # 审查一次改动
│   ├── stop-wishing-audit/SKILL.md   # 全仓审计
│   └── stop-wishing-debt/SKILL.md    # 技术债台账
├── LICENSE                           # AGPL-3.0-or-later 全文
├── THIRD-PARTY-NOTICES.md            # ponytail (MIT) 的版权与许可声明
├── install.js                        # 安装四个技能（--dry-run / --force / --tool / --dest / --target / --verify）
├── adapters/                         # 各编辑器接入说明
├── portable/                         # 便携单文件（由 build-portable.js 生成）
├── test/                             # node --test 用例
└── .hardcodeignore                   # 本仓自己的抑制清单（每条都要写理由）
```

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

   - `--dest <skills 根目录>` = 直接作为 skills 根目录，下面创建 4 个技能子目录；
   - `--target <base>` = **兼容旧用法**，同样把 4 个技能装到 `<base>/stop-wishing{,-review,-audit,-debt}`。

   `--verify` 逐文件与源做 hash 比对：`[PASS] 齐全且与源一致` / `[WARN] 齐全但内容落后于源（退出码 4，建议加 --force 更新）` / `[FAIL] 缺失或不一致（退出码 3）`。总体退出码：0 成功或 dry-run / 1 参数或覆盖冲突 / 2 源文件缺失 / 3 缺失或不一致 / 4 落后于源。

5. **验证**：目标 skills 根目录下必须有 `stop-wishing/`、`stop-wishing-review/`、`stop-wishing-audit/`、`stop-wishing-debt/` 四个目录，每个含 `SKILL.md`；主技能另有 `scripts/`（4 个）、`templates/zh` 与 `templates/en`（各 7 份）、`LICENSE`。`--verify` 全 PASS 才算装好。
6. **失败处理**：若写入被沙箱/权限拒绝，**不要反复重试**，直接告诉用户「需要你手动执行」，并给出可直接复制的命令：

   ```bash
   # macOS / Linux
   mkdir -p ~/.agents/skills
   cp -R skills/stop-wishing         ~/.agents/skills/stop-wishing
   cp -R skills/stop-wishing-review  ~/.agents/skills/stop-wishing-review
   cp -R skills/stop-wishing-audit   ~/.agents/skills/stop-wishing-audit
   cp -R skills/stop-wishing-debt    ~/.agents/skills/stop-wishing-debt

   # Windows PowerShell
   New-Item -ItemType Directory -Force "$env:USERPROFILE\.agents\skills" | Out-Null
   Copy-Item skills\stop-wishing* "$env:USERPROFILE\.agents\skills\" -Recurse
   ```

7. **装完告诉用户怎么触发**：输入 `/stop-wishing`，或直接说「用 stop-wishing 流程」（也可说「先解释再写码」「改动前备份」等触发词）。审查/审计/债务分别用 `/stop-wishing-review`、`/stop-wishing-audit`、`/stop-wishing-debt`。

## 许可证

本仓库自身以 **AGPL-3.0-or-later**（GNU Affero General Public License v3.0 或更高版本）发布，全文见仓库根目录的 [`LICENSE`](LICENSE)。

- 你可以按 AGPL 条款**使用、修改、再分发**；
- 分发修改版时需保留同样的许可证与版权声明；若把它作为网络服务提供给别人使用，AGPL 第 13 条要求向使用者提供对应源码；
- 主技能另外**要求使用者在引入任何外部东西之前**过一遍许可证闸门（代码依赖、字体、图标/图片、第三方 API 条款、模板片段），并把结论写进项目里的 `docs/LICENSES.md`。

`stop-wishing` 的部分内容改写并合并自 MIT 许可的 **ponytail**（Copyright (c) 2026 DietrichGebert）。完整 MIT 文本与归属说明见 [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)。
