# 安装到 Claude Code（adapter）

> 只复制文件，不改 Claude Code 的任何配置；出问题删目录即可回滚。

## 做法（手动，最稳）

1. 在这个 skill 仓库里跑一次便携版构建（可选，但推荐，方便单文件阅读）：
   ```bash
   node scripts/build-portable.js
   ```
2. 把整个目录复制到 Claude Code 的 skills 目录：

   ```bash
   # macOS / Linux
   mkdir -p ~/.claude/skills
   cp -R . ~/.claude/skills/stop-wishing

   # Windows PowerShell
   New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
   Copy-Item . "$env:USERPROFILE\.claude\skills\stop-wishing" -Recurse
   ```

3. 重启 Claude Code（或重新打开会话），确认技能列表里出现 `stop-wishing`。
4. 反安装：删掉 `~/.claude/skills/stop-wishing` 即可（本 skill 不在别处留状态）。

## 也可以用它自带的安装器

```bash
node install.js --dry-run          # 先看会复制什么（不写盘）
node install.js --claude           # 复制到 ~/.agents/skills + ~/.claude/skills
node install.js --claude --force   # 目标已存在时覆盖
```

- 默认**不覆盖**已存在的目标；`--force` 才覆盖；
- 复制内容不含 `.git`、`node_modules`、`test`、临时文件；
- `--target <目录>` 可以把 base 目录换到别处（测试与多环境用）。

## 注意

- Claude Code 对 skill 目录里的额外文件（templates/scripts/adapters）是容忍的；如果某个版本只认 `SKILL.md`，至少 `SKILL.md` 必须完整复制。
- 不要把本目录复制进**项目仓**的 `.claude`（会污染项目）；放用户级 skills 目录。
