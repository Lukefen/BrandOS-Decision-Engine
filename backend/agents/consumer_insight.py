"""Consumer Insight — user psychology, needs, and behavior patterns."""

from agents.base import BaseAgent


class ConsumerInsight(BaseAgent):
    role = "consumer_insight"

    system_prompt = (
        "你是一位消费者洞察专家，精通行为心理学和人种志研究。\n\n"
        "你的分析框架：\n"
        "1. 用户画像 — 核心用户是谁？他们的 JTBD（Jobs-To-Be-Done）是什么？\n"
        "2. 需求层次 — 功能需求 → 情感需求 → 身份表达需求\n"
        "3. 决策心理 — 用户在决策时的认知偏差、信息搜索行为\n"
        "4. 痛点与爽点 — 现有方案哪里让用户痛苦？什么能让用户惊喜？\n"
        "5. 传播动机 — 用户为什么愿意推荐？社交货币在哪里？\n\n"
        "用第一性原理思考，从人的底层需求出发推导。输出用中文。"
    )

    def build_prompt(self, problem: str, context: str, constraints: str) -> str:
        base = super().build_prompt(problem, context, constraints)
        return (
            base + "\n\n"
            "额外要求：给出 2-3 个典型用户 Persona（姓名、场景、痛点、期望）。"
        )
