"""Pydantic schemas for the Decision Intelligence Engine."""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class AgentRole(str, Enum):
    BRAND_STRATEGIST = "brand_strategist"
    MARKET_ANALYST = "market_analyst"
    CONSUMER_INSIGHT = "consumer_insight"
    RISK_ASSESSOR = "risk_assessor"
    SYNTHESIZER = "synthesizer"


ROLE_LABELS: dict[str, str] = {
    "brand_strategist": "品牌策略师",
    "market_analyst": "市场分析师",
    "consumer_insight": "消费者洞察师",
    "risk_assessor": "风险评估师",
    "synthesizer": "决策综合师",
}

ROLE_ICONS: dict[str, str] = {
    "brand_strategist": "🎯",
    "market_analyst": "📊",
    "consumer_insight": "👁",
    "risk_assessor": "🛡",
    "synthesizer": "⚖",
}


# ---- Request ----
class DecisionRequest(BaseModel):
    problem: str = Field(default="", description="决策问题描述")
    context: Optional[str] = Field(default="", description="补充上下文")
    constraints: Optional[str] = Field(default="", description="约束条件")
    model: Optional[str] = Field(default="", description="覆盖默认模型")
    user_input: Optional[str] = Field(default="", description="自然语言输入（新流程）")


# ---- Agent reasoning step ----
class AgentThought(BaseModel):
    agent: str
    role_label: str
    icon: str
    reasoning: str          # full reasoning text (markdown)
    key_insights: list[str] # extracted key points
    confidence: float       # 0.0 – 1.0


# ---- Cross-validation result ----
class CrossValidation(BaseModel):
    agreements: list[str]   # points all agents agree on
    conflicts: list[dict]   # [{"point":"...", "agent_a":"...", "agent_b":"..."}]
    risk_flags: list[str]   # risks identified by multiple agents


# ---- Synthesis result ----
class SynthesisResult(BaseModel):
    recommendation: str     # final recommendation (markdown)
    options: list[dict]     # [{"option":"...", "pros":[...], "cons":[...], "score":0-100}]
    next_steps: list[str]   # actionable next steps
    confidence: float       # overall confidence


# ---- Intent Detection ----
class IntentType(str, Enum):
    VAGUE_IDEA = "vague_idea"
    STRUCTURED_PROBLEM = "structured_problem"
    DOCUMENT_BRIEF = "document_brief"


class IntentResult(BaseModel):
    intent_type: IntentType
    summary: str = ""
    extracted_problem: str = ""
    extracted_context: str = ""
    extracted_constraints: str = ""
    needs_clarification: bool = False
    clarification_questions: list[str] = []


# ---- Prompt Optimization ----
class OptimizedPrompt(BaseModel):
    refined_problem: str
    refined_context: str = ""
    refined_constraints: str = ""
    optimization_notes: str = ""


# ---- Document Parsing ----
class ParsedDocument(BaseModel):
    problem: str
    context: str = ""
    constraints: str = ""
    key_entities: list[str] = []
    timeline: str = ""


# ---- Clarification (WebSocket message from client) ----
class ClarificationResponse(BaseModel):
    answers: list[str]


# ---- Full response (streamed via SSE / WebSocket) ----
class DecisionEvent(BaseModel):
    type: str               # "agent_start" | "agent_thought" | "agent_done" |
                            # "cross_validation" | "synthesis" | "done" | "error"
    agent: Optional[str] = None
    role_label: Optional[str] = None
    icon: Optional[str] = None
    content: Optional[str] = None        # streaming chunk or final text
    key_insights: Optional[list[str]] = None
    confidence: Optional[float] = None
    cross_validation: Optional[CrossValidation] = None
    synthesis: Optional[SynthesisResult] = None
    message: Optional[str] = None
    intent_result: Optional[IntentResult] = None
    optimized_prompt: Optional[OptimizedPrompt] = None
    clarification_questions: Optional[list[str]] = None


# ---- History entry (persisted) ----
class HistoryEntry(BaseModel):
    id: str
    timestamp: str
    problem: str
    context: str
    agents: list[AgentThought]
    cross_validation: CrossValidation
    synthesis: SynthesisResult
