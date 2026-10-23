---
name: stop-wishing
description: 治许愿式编程（中文规范见 SKILL.md）。
user-invocable: true
---

# stop-wishing · 摘要（Codex / AGENTS.md 适配层）

这个文件是给「只读 AGENTS.md 的编辑器」看的摘要。**唯一的真源是 `skills/stop-wishing/SKILL.md`**，
本文件只负责把「什么时候该读它」说清楚。仓库另有 `stop-wishing-review` / `stop-wishing-audit` /
`stop-wishing-debt` 三个卫星技能，分别用于审查改动、全仓审计和技术债台账。

## 什么时候必须先读 SKILL.md

- 用户给的指令只有一句话、没有边界与验收；
- 出现「随便 / 你看着办 / 差不多就行 / 做个 XX / 优化一下」这类许愿句；
- 要在已存在的仓库里改代码或配置；
- 要引入依赖、字体、图标/图片、第三方 API、模板片段（必须过许可证闸门）；
- 用户说「先解释再写码」「改动前备份」「别硬编码」「初始化项目文档」。

## 三条不许跳的硬规矩

1. **先说档位**：进 SKILL.md 第一件事是报「轻 / 中 / 重」与原因，不许默默开工；
2. **先解释、后动手**：改什么、影响什么、风险、怎么退；用户确认后才写码；
3. **动手前备份**：git 仓库打 tag，否则 `.bak-YYYYMMDD-HHmm`。

## 完整流程

需求卡（七字段）→ 搜索留痕 → 先解释并等确认 → 备份 → 最小差异实现 → 验证留证据 → 更新 project/progress/todo → 汇报。

细节、术语对照表、许可证矩阵、三列表证据格式、逃生门，全部在 `skills/stop-wishing/SKILL.md`。
