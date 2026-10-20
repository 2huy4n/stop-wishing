# stop-wishing

治「许愿式编程」的 skill：**用户给一句模糊指令，AI 别急着写码，先对齐目标/边界/验收、先解释、先备份，再最小差异动手。**

唯一真源是 [`SKILL.md`](SKILL.md)（13 章：触发条件、定义、说话方式与术语表、模糊度分档、需求卡、默认值、许可证闸门、工作循环、硬约束、证据格式、冲突裁决、失败处理、逃生门）。

## 怎么装

```bash
# 只看看会复制什么（不写盘）
node install.js --dry-run

# 装到用户级 skills 目录：~/.agents/skills/stop-wishing
node install.js

# 同时装给 Claude Code：~/.claude/skills/stop-wishing
node install.js --claude

# 目标已存在、确实要覆盖时才加 --force
node install.js --force
```

编辑器适配说明见 [`adapters/`](adapters/)：`claude-code/README.md`、`codex/AGENTS.md`、`trae/README.md`。

## 目录说明

```text
stop-wishing/
├── SKILL.md              # 唯一真源（13 章）
├── LICENSE               # AGPL-3.0-or-later 全文
├── install.js            # 复制到用户级 skills 目录（--dry-run / --force / --claude / --target）
├── scripts/
│   ├── check-env.js      # git/bash/node/仓库探测 → JSON + 备份建议
│   ├── init-docs.js      # 生成 7 份项目文档到 <dir>/docs/
│   ├── check-hardcode.js # 硬编码扫描（支持 .hardcodeignore）
│   └── build-portable.js # 生成 portable/stop-wishing.md
├── templates/{zh,en}/    # 7 份项目文档模板（project/content/structure/progress/todo/discipline/LICENSES）
├── adapters/             # 各编辑器接入说明
├── portable/             # 便携单文件（由 build-portable.js 生成）
├── test/                 # node --test 用例
└── .hardcodeignore       # 本仓自己的抑制清单（每条都要写理由）
```

## 给 AI 看：用户不会装时按此执行

给 claude/gpt/kimi/deepseek/glm/hy/minimax/qwen 或者任何 AI 看：
如果用户不会装 skill 文件，请 AI 参考以下步骤安装本 skill

1. **前置检查**：`node --version` 要求 **≥18**；确认你有目标目录的写权限（写不了走第 6 步，不要硬闯）。
2. **获取文件**：`git clone <本仓库地址>`，或把压缩包解压到临时目录，然后 `cd` 进该目录（能看到 `SKILL.md` 就对了）。
3. **判断目标路径**（先问清用户用的是什么工具）：

   | 用户用的工具 | 目标目录 |
   |---|---|
   | DSH / Codex / TRAE | `~/.agents/skills/stop-wishing/` |
   | Claude Code | `~/.claude/skills/stop-wishing/` |
   | **不确定** | **先问用户「你用的是哪个工具？」**，不要猜 |

   若**无法向用户提问**（无人值守 / 用户已离开），按当前运行环境判断（例如 DSH → `~/.agents/skills`），并在最终报告里写明「**我假设你用的是 X**」；仍不确定时优先装到 `~/.agents/skills`（DSH/Codex/TRAE 三工具共用）。

4. **安装**（`--verify` 会自检并逐项打印 PASS/WARN/FAIL）：

   ```bash
   node install.js --tool dsh    --verify   # DSH / Codex / TRAE
   node install.js --tool claude --verify   # Claude Code
   ```

   参数：`--tool` / `--dest` / `--verify` / `--dry-run` / `--force` / `--target`。其中：

   - `--dest <目录>` = **精确目标目录**（直接装进这个目录，优先级最高）；
   - `--target <base>` = **兼容旧用法**，只给 base 目录，实际装到 `<base>/stop-wishing`。

   `--verify` 逐文件与源做 hash 比对：`[PASS] 齐全且与源一致` / `[WARN] 齐全但内容落后于源（退出码 4，建议加 --force 更新）` / `[FAIL] 缺失或不一致（退出码 3）`。总体退出码：0 成功或 dry-run / 1 参数或覆盖冲突 / 2 源文件缺失 / 3 缺失或不一致 / 4 落后于源。

5. **验证**：目标目录下必须有 `SKILL.md`（front-matter 含 `name: stop-wishing`）、`scripts/`（4 个脚本齐全）、`templates/zh` 与 `templates/en`（各 7 份）、`LICENSE`。`--verify` 全 PASS 才算装好；有 FAIL 就按输出补齐或重装，不要只口头宣称成功。
6. **失败处理**：若写入被沙箱/权限拒绝，**不要反复重试**，直接告诉用户「需要你手动执行」，并给出可直接复制的命令：

   ```bash
   # macOS / Linux
   mkdir -p ~/.agents/skills && cp -R . ~/.agents/skills/stop-wishing

   # Windows PowerShell
   New-Item -ItemType Directory -Force "$env:USERPROFILE\.agents\skills" | Out-Null
   Copy-Item . "$env:USERPROFILE\.agents\skills\stop-wishing" -Recurse
   ```

7. **装完告诉用户怎么触发**：输入 `/stop-wishing`，或直接说「用 stop-wishing 流程」（也可说「先解释再写码」「改动前备份」等触发词）。

## 许可证

本 skill 自身以 **AGPL-3.0-or-later**（GNU Affero General Public License v3.0 或更高版本）发布，全文见仓库根目录的 [`LICENSE`](LICENSE)。

- 你可以按 AGPL 条款**使用、修改、再分发**本 skill；
- 分发修改版时需保留同样的许可证与版权声明；若把它作为网络服务提供给别人使用，AGPL 第 13 条要求向使用者提供对应源码；
- 本 skill 另外**要求使用者在引入任何外部东西之前**过一遍 `SKILL.md` §7 的许可证闸门（代码依赖、字体、图标/图片、第三方 API 条款、模板片段），并把结论写进项目里的 `docs/LICENSES.md`。

