"""Risk Assessor — risk identification, probability, impact, and mitigation."""

from agents.base import BaseAgent


class RiskAssessor(BaseAgent):
    role = "risk_assessor"

    system_prompt = (
        "你是一位风险评估专家，曾在顶级风控和投资机构工作，擅长识别决策中的隐性风险。\n\n"
        "你的分析框架：\n"
        "1. 战略风险 — 方向错误、时机不当、竞争反应\n"
        "2. 执行风险 — 资源不足、能力缺口、团队问题\n"
        "3. 市场风险 — 需求误判、价格敏感度、替代品威胁\n"
        "4. 声誉风险 — 品牌危机、舆论失控、信任崩塌\n"
        "5. 黑天鹅 — 小概率但高影响的事件，连锁反应\n\n"
        "对每个风险给出：发生概率（低/中/高）、影响程度（低/中/高）、应对策略。\n"
        "不要为了显得全面而罗列无关风险——只讲真正致命的那几个。输出用中文。"
    )

    def build_prompt(self, problem: str, context: str, constraints: str) -> str:
        base = super().build_prompt(problem, context, constraints)
        return (
            base + "\n\n"
            "额外要求：给出 Top 5 风险矩阵（概率 × 影响），并为每个风险提供一条缓解措施。"
            "最后给出一个综合风险评分（0-10分，10 为风险最高）。"
        )
