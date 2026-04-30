"""Intent Detection — classifies user input into intent types."""

import json
import re
from models.schemas import IntentResult, IntentType
from core.llm_client import llm
from config import INTENT_MAX_TOKENS

SYSTEM_PROMPT = """你是一个意图识别专家。分析用户的输入，判断其属于以下哪种类型：

1. vague_idea — 模糊的想法或灵感，缺少具体信息（例如"我想做个咖啡品牌"）
2. structured_problem — 结构化的商业问题，包含明确的背景和目标（例如详细的品牌困境描述）
3. document_brief — 粘贴的文档或方案，包含大量结构化信息（例如完整的商业计划书、品牌brief）

请以JSON格式输出：
{
  "intent_type": "vague_idea" 或 "structured_problem" 或 "document_brief",
  "summary": "一句话总结用户想要做什么",
  "extracted_problem": "提取的核心决策问题",
  "extracted_context": "提取的背景信息",
  "extracted_constraints": "提取的约束条件",
  "needs_clarification": true/false,
  "clarification_questions": ["问题1", "问题2"]
}

规则：
- 如果是vague_idea，needs_clarification设为true，生成2-3个针对性的澄清问题
- 如果是structured_problem或document_brief，needs_clarification设为false
- clarification_questions用中文
- 只输出JSON，不要有其他文字"""


class IntentDetector:
    def detect(self, user_input: str) -> IntentResult:
        """Classify user input into an intent type."""
        if not llm.available:
            return self._offline_detect(user_input)

        raw = llm.chat(SYSTEM_PROMPT, user_input, temperature=0.1, max_tokens=INTENT_MAX_TOKENS)
        if not raw:
            return self._offline_detect(user_input)

        return self._parse_response(raw, user_input)

    def _parse_response(self, raw: str, user_input: str) -> IntentResult:
        """Parse LLM JSON response into IntentResult."""
        # Try to extract JSON from the response
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if json_match:
            try:
                data = json.loads(json_match.group())
                return IntentResult(
                    intent_type=IntentType(data.get("intent_type", "structured_problem")),
                    summary=data.get("summary", ""),
                    extracted_problem=data.get("extracted_problem", ""),
                    extracted_context=data.get("extracted_context", ""),
                    extracted_constraints=data.get("extracted_constraints", ""),
                    needs_clarification=data.get("needs_clarification", False),
                    clarification_questions=data.get("clarification_questions", []),
                )
            except (json.JSONDecodeError, ValueError):
                pass

        # Fallback: treat as structured problem
        return IntentResult(
            intent_type=IntentType.STRUCTURED_PROBLEM,
            summary=user_input[:100],
            extracted_problem=user_input,
        )

    def _offline_detect(self, user_input: str) -> IntentResult:
        """Offline heuristic detection when no API key is configured."""
        text = user_input.strip()
        length = len(text)

        # Short input = vague idea
        if length < 50:
            return IntentResult(
                intent_type=IntentType.VAGUE_IDEA,
                summary=text[:100],
                extracted_problem=text,
                needs_clarification=True,
                clarification_questions=[
                    "你的目标用户群体是谁？",
                    "你有什么独特的资源优势或差异化定位？",
                    "你的预算和时间规划是怎样的？",
                ],
            )

        # Long input with document keywords = document brief
        doc_keywords = ["brief", "方案", "报告", "计划书", "需求", "背景", "目标", "预算", "timeline"]
        if length > 500 and any(kw in text.lower() for kw in doc_keywords):
            return IntentResult(
                intent_type=IntentType.DOCUMENT_BRIEF,
                summary="检测到文档型输入",
                extracted_problem=text[:200],
                extracted_context=text,
            )

        # Default: structured problem
        return IntentResult(
            intent_type=IntentType.STRUCTURED_PROBLEM,
            summary=text[:100],
            extracted_problem=text,
        )


intent_detector = IntentDetector()
