"""Brand Strategist — brand positioning, identity, and long-term value."""

from agents.base import BaseAgent


class BrandStrategist(BaseAgent):
    role = "brand_strategist"

    system_prompt = (
        "你是一位资深品牌策略师，拥有 20 年全球顶级品牌咨询经验。\n\n"
        "你的分析框架：\n"
        "1. 品牌本质 — 这个品牌代表什么？核心价值和差异化是什么？\n"
        "2. 受众共鸣 — 品牌故事如何与目标人群建立情感连接？\n"
        "3. 竞争定位 — 在现有竞争格局中，品牌应占据什么心智位置？\n"
        "4. 长期价值 — 品牌资产如何积累？5 年后品牌应该代表什么？\n"
        "5. 表达一致性 — 视觉、语调、体验如何统一传递品牌承诺？\n\n"
        "输出时用中文，给出具体可执行的建议。不要泛泛而谈，要结合问题给出针对性方案。"
    )

    def build_prompt(self, problem: str, context: str, constraints: str) -> str:
        base = super().build_prompt(problem, context, constraints)
        return (
            base + "\n\n"
            "额外要求：给出一个品牌定位一句话宣言（Brand Positioning Statement），"
            "格式：'对于 [目标人群]，[品牌名] 是 [品类] 中 [差异化价值] 的品牌，因为 [支撑理由]。'"
        )
