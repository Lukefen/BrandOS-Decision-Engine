"""Base agent — all specialist agents inherit from this."""

from core.llm_client import llm
from models.schemas import AgentThought, ROLE_LABELS, ROLE_ICONS


class BaseAgent:
    role: str = "base"
    system_prompt: str = ""

    def __init__(self):
        self.llm = llm

    @property
    def label(self) -> str:
        return ROLE_LABELS.get(self.role, self.role)

    @property
    def icon(self) -> str:
        return ROLE_ICONS.get(self.role, "🤖")

    def build_prompt(self, problem: str, context: str, constraints: str) -> str:
        """Build the user message for this agent. Override in subclasses."""
        parts = [f"## 决策问题\n{problem}"]
        if context:
            parts.append(f"## 补充背景\n{context}")
        if constraints:
            parts.append(f"## 约束条件\n{constraints}")
        parts.append(
            "请从你的专业视角进行深度分析。输出结构如下：\n\n"
            "### 核心观点\n（列出 3-5 个关键发现）\n\n"
            "### 详细分析\n（展开每一个观点，给出推理依据）\n\n"
            "### 风险与机会\n（识别潜在风险和机会窗口）\n\n"
            "### 置信度\n（给出 0.0-1.0 的自评置信度分数）"
        )
        return "\n\n".join(parts)

    def reason(self, problem: str, context: str = "", constraints: str = "") -> AgentThought:
        """Execute reasoning and return structured thought."""
        user_msg = self.build_prompt(problem, context, constraints)
        raw = self.llm.chat(self.system_prompt, user_msg)
        insights = self._extract_insights(raw)
        confidence = self._extract_confidence(raw)
        return AgentThought(
            agent=self.role,
            role_label=self.label,
            icon=self.icon,
            reasoning=raw or "*（离线模式：基于模板推理）*",
            key_insights=insights,
            confidence=confidence,
        )

    def reason_stream(self, problem: str, context: str = "", constraints: str = ""):
        """Streaming reasoning — yields text chunks."""
        user_msg = self.build_prompt(problem, context, constraints)
        for chunk in self.llm.chat_stream(self.system_prompt, user_msg):
            yield chunk

    def _extract_insights(self, text: str) -> list[str]:
        """Extract key insights bullet points from reasoning text."""
        if not text:
            return ["基于模板推理：需要配置 API Key 以获得深度分析"]
        insights = []
        for line in text.split("\n"):
            stripped = line.strip()
            if stripped.startswith(("- ", "* ", "• ", "1.", "2.", "3.", "4.", "5.")):
                clean = stripped.lstrip("- *•0123456789. ").strip()
                if len(clean) > 10:
                    insights.append(clean)
        return insights[:5] if insights else [text[:120]]

    def _extract_confidence(self, text: str) -> float:
        """Extract confidence score from text."""
        if not text:
            return 0.5
        import re
        # look for patterns like "置信度: 0.85" or "confidence: 0.7"
        patterns = [
            r"置信度[：:]\s*([0-9.]+)",
            r"confidence[：:]\s*([0-9.]+)",
            r"置信度[：:]\s*(\d+)%",
            r"(\d+)%\s*置信",
        ]
        for p in patterns:
            m = re.search(p, text.lower())
            if m:
                val = float(m.group(1))
                return val / 100.0 if val > 1 else min(val, 1.0)
        return 0.7  # default
