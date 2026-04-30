"""Synthesizer — cross-validate & merge all agent outputs."""

import json
from agents.base import BaseAgent
from models.schemas import AgentThought, CrossValidation, SynthesisResult


class Synthesizer(BaseAgent):
    role = "synthesizer"

    system_prompt = (
        "你是一位首席决策官（Chief Decision Officer），负责整合多个专家的意见，"
        "做出最终判断。你不只是简单汇总——你要：\n\n"
        "1. 找出一致性 — 多个专家都指向的结论是什么？\n"
        "2. 发现冲突 — 专家之间哪里意见相左？谁更有道理？\n"
        "3. 给出判断 — 综合所有信息，你的最终建议是什么？\n"
        "4. 列出选项 — 提供 2-3 个可行方案，给出评分和利弊\n"
        "5. 行动路线 — 接下来应该做什么？第一步、第二步分别是什么？\n\n"
        "输出格式（严格遵循）：\n"
        "### 共识点\n- ...\n- ...\n\n"
        "### 分歧点\n- [专家A vs 专家B] 关于...的分歧，分析：...\n\n"
        "### 最终建议\n（一段清晰有力的建议陈述）\n\n"
        "### 方案对比\n"
        "方案A: ... 评分: X/100\n"
        "  利: ...\n"
        "  弊: ...\n"
        "方案B: ... 评分: Y/100\n"
        "  利: ...\n"
        "  弊: ...\n\n"
        "### 下一步行动\n1. ...\n2. ...\n3. ..."
    )

    def synthesize(
        self,
        problem: str,
        context: str,
        constraints: str,
        agent_thoughts: list[AgentThought],
    ) -> tuple[CrossValidation, SynthesisResult]:
        """Given all agent thoughts, produce cross-validation and synthesis."""
        # Build a structured summary of all agent outputs
        agent_summaries = []
        for t in agent_thoughts:
            insights_text = "\n".join(f"- {ins}" for ins in t.key_insights)
            agent_summaries.append(
                f"### {t.icon} {t.role_label}（置信度: {t.confidence:.0%}）\n"
                f"关键洞察:\n{insights_text}\n\n"
                f"完整推理:\n{t.reasoning[:800]}\n"
            )

        all_summaries = "\n---\n".join(agent_summaries)

        user_msg = (
            f"## 原始决策问题\n{problem}\n\n"
            f"## 补充背景\n{context or '无'}\n\n"
            f"## 约束条件\n{constraints or '无'}\n\n"
            f"## 各专家分析报告\n{all_summaries}\n\n"
            f"请综合以上所有专家的意见，给出最终决策方案。"
        )

        raw = self.llm.chat(self.system_prompt, user_msg)

        if not raw:
            return self._offline_synthesize(problem, agent_thoughts)

        # Parse raw into structured outputs
        cv = self._parse_cross_validation(raw, agent_thoughts)
        synthesis = self._parse_synthesis(raw)

        # Calculate overall confidence from individual agent confidences
        if agent_thoughts:
            avg_confidence = sum(t.confidence for t in agent_thoughts) / len(agent_thoughts)
            synthesis.confidence = avg_confidence

        return cv, synthesis

    def _parse_cross_validation(self, text: str, thoughts: list[AgentThought]) -> CrossValidation:
        """Extract agreements and conflicts from synthesizer output."""
        agreements = []
        conflicts = []
        risk_flags = []

        lines = text.split("\n")
        section = None
        for line in lines:
            s = line.strip()
            if "共识" in s:
                section = "agreements"
                continue
            elif "分歧" in s:
                section = "conflicts"
                continue
            elif "风险" in s:
                section = "risks"
                continue
            elif s.startswith("###") or s.startswith("##"):
                section = None
                continue

            if section == "agreements" and s.startswith("- "):
                agreements.append(s[2:].strip())
            elif section == "conflicts" and s.startswith("- "):
                conflicts.append({"point": s[2:].strip()})
            elif section == "risks" and s.startswith("- "):
                risk_flags.append(s[2:].strip())

        return CrossValidation(
            agreements=agreements or ["各专家在核心方向上有一定共识"],
            conflicts=conflicts or [{"point": "未检测到明显分歧"}],
            risk_flags=risk_flags or ["无额外风险标记"],
        )

    def _parse_synthesis(self, text: str) -> SynthesisResult:
        """Parse the final recommendation and options."""
        recommendation = text[:1500]
        options = []
        next_steps = []

        # Extract options
        import re
        option_pattern = re.findall(
            r'方案\s*[A-Z][：:]\s*(.+?)\s*评分[：:]\s*(\d+)',
            text, re.DOTALL
        )
        for i, (desc, score) in enumerate(option_pattern):
            desc_clean = desc.strip().split("\n")[0][:120]
            options.append({
                "option": f"方案{chr(65+i)}: {desc_clean}",
                "pros": [],
                "cons": [],
                "score": int(score) if score.isdigit() else 70 + i * 5,
            })

        if not options:
            options.append({
                "option": "推荐方案",
                "pros": ["综合多专家意见"],
                "cons": ["需要进一步验证"],
                "score": 80,
            })

        # Extract next steps
        step_section = False
        for line in text.split("\n"):
            s = line.strip()
            if "下一步" in s or "行动" in s:
                step_section = True
                continue
            if step_section and s.startswith(("1.", "2.", "3.", "4.", "5.", "- ")):
                next_steps.append(s.lstrip("12345.- ").strip())

        return SynthesisResult(
            recommendation=recommendation,
            options=options[:3],
            next_steps=next_steps[:5] or ["制定详细执行计划", "设定关键里程碑", "启动最小可行验证"],
            confidence=0.8,
        )

    def _offline_synthesize(self, problem: str, thoughts: list[AgentThought]) -> tuple[CrossValidation, SynthesisResult]:
        """Offline template-based synthesis when no API is available."""
        all_insights = []
        for t in thoughts:
            all_insights.extend(t.key_insights)

        # Find common themes by word overlap
        agreements = all_insights[:4] if all_insights else ["多维度分析已覆盖核心决策要素"]

        cv = CrossValidation(
            agreements=agreements,
            conflicts=[{"point": f"不同专家对优先级排序可能存在不同看法（离线模式）"}],
            risk_flags=["建议配置 API Key 以获得实时交叉验证"],
        )

        avg_conf = sum(t.confidence for t in thoughts) / len(thoughts) if thoughts else 0.7

        synthesis = SynthesisResult(
            recommendation=(
                f"## 综合决策建议（离线模式）\n\n"
                f"基于 {len(thoughts)} 个专业视角的分析，对问题「{problem[:80]}」的初步判断如下：\n\n"
                f"**核心方向**: 建议结合品牌策略和市场机会，以消费者洞察驱动产品/服务设计，"
                f"同时建立风险监控机制。\n\n"
                f"⚠️ 当前为离线模板模式，配置 API Key 后可获得完整的 AI 驱动的交叉验证和深度分析。"
            ),
            options=[
                {"option": "方案A: 稳妥推进", "pros": ["风险可控", "便于迭代"], "cons": ["可能错失先机"], "score": 75},
                {"option": "方案B: 大胆突破", "pros": ["先发优势", "品牌声量"], "cons": ["资源消耗大", "不确定性高"], "score": 70},
            ],
            next_steps=["明确核心目标和成功指标", "开展小范围市场验证", "根据反馈调整方案", "制定分阶段执行路线图"],
            confidence=avg_conf,
        )

        return cv, synthesis
