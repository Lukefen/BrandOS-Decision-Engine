"""Prompt Optimizer — refines user input into optimized agent prompts."""

import json
import re
from models.schemas import OptimizedPrompt
from core.llm_client import llm
from config import OPTIMIZER_MAX_TOKENS

SYSTEM_PROMPT = """你是一个决策分析优化专家。你的任务是将用户的输入优化为适合多专家分析的结构化问题。

根据输入类型，执行不同的优化策略：
- vague_idea（模糊想法）：将想法扩展为结构化的决策问题，补充合理的假设背景
- structured_problem（结构化问题）：轻微优化格式和表述，确保问题清晰
- document_brief（文档方案）：提取核心决策点，重组为清晰的问题/背景/约束

请以JSON格式输出：
{
  "refined_problem": "优化后的核心决策问题（清晰、具体、可分析）",
  "refined_context": "优化后的背景信息（包含关键数据和市场环境）",
  "refined_constraints": "优化后的约束条件（预算、时间、资源限制）",
  "optimization_notes": "说明做了哪些优化以及为什么"
}

规则：
- 保持用户原始意图不变
- 用中文输出
- 只输出JSON"""


class PromptOptimizer:
    def optimize(self, problem: str, context: str, constraints: str, intent_type: str) -> OptimizedPrompt:
        """Optimize the user input for multi-agent analysis."""
        if not llm.available:
            return self._offline_optimize(problem, context, constraints)

        user_msg = f"【输入类型】{intent_type}\n\n【问题】{problem}"
        if context:
            user_msg += f"\n\n【背景】{context}"
        if constraints:
            user_msg += f"\n\n【约束】{constraints}"

        raw = llm.chat(SYSTEM_PROMPT, user_msg, temperature=0.3, max_tokens=OPTIMIZER_MAX_TOKENS)
        if not raw:
            return self._offline_optimize(problem, context, constraints)

        return self._parse_response(raw, problem, context, constraints)

    def _parse_response(self, raw: str, problem: str, context: str, constraints: str) -> OptimizedPrompt:
        """Parse LLM JSON response."""
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if json_match:
            try:
                data = json.loads(json_match.group())
                return OptimizedPrompt(
                    refined_problem=data.get("refined_problem", problem),
                    refined_context=data.get("refined_context", context),
                    refined_constraints=data.get("refined_constraints", constraints),
                    optimization_notes=data.get("optimization_notes", ""),
                )
            except (json.JSONDecodeError, ValueError):
                pass

        # Fallback: return original input
        return OptimizedPrompt(
            refined_problem=problem,
            refined_context=context,
            refined_constraints=constraints,
            optimization_notes="无法解析优化结果，使用原始输入",
        )

    def _offline_optimize(self, problem: str, context: str, constraints: str) -> OptimizedPrompt:
        """Offline fallback — return original input with light formatting."""
        return OptimizedPrompt(
            refined_problem=problem,
            refined_context=context,
            refined_constraints=constraints,
            optimization_notes="离线模式：使用原始输入（未配置API Key）",
        )


prompt_optimizer = PromptOptimizer()
