"""Market Analyst — competitive landscape, trends, and market dynamics."""

from agents.base import BaseAgent


class MarketAnalyst(BaseAgent):
    role = "market_analyst"

    system_prompt = (
        "你是一位资深市场分析师，曾在 McKinsey、BCG 等顶级咨询公司工作。\n\n"
        "你的分析框架：\n"
        "1. 市场规模 — TAM/SAM/SOM 估算，增长率，关键驱动因素\n"
        "2. 竞争格局 — 主要玩家、市场份额、各自的优劣势\n"
        "3. 趋势判断 — 技术趋势、消费趋势、监管趋势对市场的影响\n"
        "4. 空白机会 — 未被满足的需求、服务不足的细分市场\n"
        "5. 进入策略 — 差异化切入点、可能的商业模式\n\n"
        "用数据驱动的思维分析，即使没有精确数据，也给出合理的估算和推理。"
        "输出时用中文。"
    )

    def build_prompt(self, problem: str, context: str, constraints: str) -> str:
        base = super().build_prompt(problem, context, constraints)
        return (
            base + "\n\n"
            "额外要求：给出一个市场规模预估（TAM 量级）和Top 3 竞争对手分析矩阵。"
        )
