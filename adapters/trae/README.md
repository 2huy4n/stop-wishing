# 安装到 Trae（adapter）

> Trae 的 skill 位置各版本略有差异；下面两套都保留，按你那一版的实际目录二选一。

## 方式 A：项目级 `.trae/skills`

1. 在**项目根**建目录：`.trae/skills/stop-wishing`
2. 把四个技能目录复制进去（至少 `SKILL.md`；建议整目录）：
   ```bash
   mkdir -p .trae/skills
   cp -R skills/stop-wishing         .trae/skills/stop-wishing
   cp -R skills/stop-wishing-review  .trae/skills/stop-wishing-review
   cp -R skills/stop-wishing-audit   .trae/skills/stop-wishing-audit
   cp -R skills/stop-wishing-debt    .trae/skills/stop-wishing-debt
   ```
3. 在 Trae 设置里确认「项目技能 / Project Skills」是打开的（不同版本叫法不同：`Skills`、`Rules & Skills`、`Agent Skills`）。
4. 反安装：删掉 `.trae/skills/` 下这四个目录。

## 方式 B：用户级 `~/.agents/skills`（与 Codex/Claude 共用一套）

1. 跑安装器（默认装四个技能到 `~/.agents/skills/`）：
   ```bash
   node install.js --dry-run   # 先看计划
   node install.js             # 真装（确认目标路径后再跑）
   ```
2. 确认 Trae 的「Agents 开关 / 用户技能」指向 `~/.agents/skills`。
3. 反安装：删掉 `~/.agents/skills/` 下的 `stop-wishing`、`stop-wishing-review`、`stop-wishing-audit`、`stop-wishing-debt`。

## 两个开关的坑

- **项目级**：只在当前项目生效，换项目要重装；
- **用户级**：所有项目生效，但多人共用的机器上会互相看见彼此的 skill；
- 两者同名时，一般项目级优先；不确定就只开一个，别同时开两份（会出现「同一件事两套说法」）。

## 验证装没装好

- 在 Trae 里新开一个会话，说「用 stop-wishing 帮我看这个需求」，看它是否先报「轻/中/重」档位；
- 或者让它引用 `SKILL.md` 的 §13 逃生门，看能不能说清内容——能说清就是读到了真源。
