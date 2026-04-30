"""Document Parser — extracts structured decision inputs from pasted documents."""

import json
import re
from models.schemas import ParsedDocument
from core.llm_client import llm
from config import PARSER_MAX_TOKENS

SYSTEM_PROMPT = """你是一个文档分析专家。用户粘贴了一份文档或方案，请从中提取决策分析所需的关键信息。

请以JSON格式输出：
{
  "problem": "核心决策问题（品牌需要做出什么决策）",
  "context": "背景信息（市场环境、竞争格局、品牌现状等）",
  "constraints": "约束条件（预算、时间、资源、政策限制等）",
  "key_entities": ["关键实体1", "关键实体2"],
  "timeline": "时间线或关键节点"
}

规则：
- 如果某个字段在文档中没有明确信息，留空字符串或空数组
- 用中文输出
- 只输出JSON"""


class DocumentParser:
    def parse(self, document_text: str) -> ParsedDocument:
        """Extract structured fields from a pasted document."""
        if not llm.available:
            return self._offline_parse(document_text)

        raw = llm.chat(SYSTEM_PROMPT, document_text, temperature=0.2, max_tokens=PARSER_MAX_TOKENS)
        if not raw:
            return self._offline_parse(document_text)

        return self._parse_response(raw, document_text)

    def _parse_response(self, raw: str, original: str) -> ParsedDocument:
        """Parse LLM JSON response."""
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if json_match:
            try:
                data = json.loads(json_match.group())
                return ParsedDocument(
                    problem=data.get("problem", original[:200]),
                    context=data.get("context", ""),
                    constraints=data.get("constraints", ""),
                    key_entities=data.get("key_entities", []),
                    timeline=data.get("timeline", ""),
                )
            except (json.JSONDecodeError, ValueError):
                pass

        # Fallback
        return ParsedDocument(
            problem=original[:200],
            context=original,
        )

    def _offline_parse(self, text: str) -> ParsedDocument:
        """Offline fallback — basic text extraction."""
        return ParsedDocument(
            problem=text[:200],
            context=text,
            constraints="",
            key_entities=[],
            timeline="",
        )


document_parser = DocumentParser()
