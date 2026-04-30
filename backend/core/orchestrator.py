"""Orchestrator — parallel agent execution with cross-validation."""

import asyncio
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

from agents.brand_strategist import BrandStrategist
from agents.market_analyst import MarketAnalyst
from agents.consumer_insight import ConsumerInsight
from agents.risk_assessor import RiskAssessor
from agents.synthesizer import Synthesizer
from core.intent_detector import intent_detector
from core.prompt_optimizer import prompt_optimizer
from agents.document_parser import document_parser
from models.schemas import (
    AgentThought, CrossValidation, SynthesisResult,
    DecisionEvent, HistoryEntry,
    IntentResult, IntentType, OptimizedPrompt,
)
from config import PARALLEL_AGENTS


AGENT_REGISTRY = {
    "brand_strategist": BrandStrategist,
    "market_analyst": MarketAnalyst,
    "consumer_insight": ConsumerInsight,
    "risk_assessor": RiskAssessor,
}

MAX_CLARIFICATION_ROUNDS = 2


class Orchestrator:
    def __init__(self):
        self.synthesizer = Synthesizer()
        self.history: list[HistoryEntry] = []
        self._executor = ThreadPoolExecutor(max_workers=len(PARALLEL_AGENTS))

    def _run_single_agent(self, role: str, problem: str, context: str, constraints: str) -> AgentThought:
        """Run a single agent and return its thought."""
        agent_cls = AGENT_REGISTRY[role]
        agent = agent_cls()
        return agent.reason(problem, context, constraints)

    async def decide(
        self,
        problem: str,
        context: str = "",
        constraints: str = "",
    ):
        """
        Run the full decision pipeline. Yields DecisionEvents for streaming.
        """
        # ---- Phase 1: Launch all agents in parallel ----
        yield DecisionEvent(type="phase", message="phase_1_start")

        loop = asyncio.get_running_loop()
        tasks = []
        for role in PARALLEL_AGENTS:
            yield DecisionEvent(
                type="agent_start",
                agent=role,
                role_label=AGENT_REGISTRY[role]().label,
                icon=AGENT_REGISTRY[role]().icon,
            )
            tasks.append(
                loop.run_in_executor(
                    self._executor,
                    self._run_single_agent,
                    role, problem, context, constraints,
                )
            )

        # Wait for all agents to complete
        agent_thoughts: list[AgentThought] = await asyncio.gather(*tasks)

        # Yield each agent's result
        for thought in agent_thoughts:
            yield DecisionEvent(
                type="agent_done",
                agent=thought.agent,
                role_label=thought.role_label,
                icon=thought.icon,
                content=thought.reasoning,
                key_insights=thought.key_insights,
                confidence=thought.confidence,
            )
            # Small delay so UI can animate
            await asyncio.sleep(0.3)

        # ---- Phase 2: Cross-validation & Synthesis ----
        yield DecisionEvent(type="phase", message="phase_2_start")
        yield DecisionEvent(
            type="agent_start",
            agent="synthesizer",
            role_label=self.synthesizer.label,
            icon=self.synthesizer.icon,
        )

        cv, synthesis = await loop.run_in_executor(
            self._executor,
            self.synthesizer.synthesize,
            problem, context, constraints, agent_thoughts,
        )

        yield DecisionEvent(
            type="cross_validation",
            agent="synthesizer",
            cross_validation=cv,
        )
        await asyncio.sleep(0.3)

        yield DecisionEvent(
            type="synthesis",
            agent="synthesizer",
            role_label=self.synthesizer.label,
            icon=self.synthesizer.icon,
            content=synthesis.recommendation,
            synthesis=synthesis,
            confidence=synthesis.confidence,
        )

        # ---- Save to history ----
        entry = HistoryEntry(
            id=uuid.uuid4().hex[:12],
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
            problem=problem,
            context=context,
            agents=agent_thoughts,
            cross_validation=cv,
            synthesis=synthesis,
        )
        self.history.append(entry)

        yield DecisionEvent(type="done", message=entry.id)

    async def run_full_pipeline(
        self,
        user_input: str,
        clarification_round: int = 0,
    ):
        """
        Full pipeline: Intent Detection → [Document Parsing] → Prompt Optimization → Multi-Agent Analysis.
        Yields DecisionEvents for streaming.
        """
        loop = asyncio.get_running_loop()

        # ---- Step 1: Intent Detection ----
        yield DecisionEvent(type="intent_detecting")

        intent_result: IntentResult = await loop.run_in_executor(
            self._executor, intent_detector.detect, user_input
        )

        yield DecisionEvent(type="intent_detected", intent_result=intent_result)

        # ---- Step 1b: Clarification if needed ----
        if intent_result.needs_clarification and clarification_round < MAX_CLARIFICATION_ROUNDS:
            yield DecisionEvent(
                type="clarification_needed",
                clarification_questions=intent_result.clarification_questions,
            )
            return  # Caller will wait for clarification response and re-invoke

        # ---- Step 2: Document Parsing (if applicable) ----
        problem = intent_result.extracted_problem or user_input
        context = intent_result.extracted_context or ""
        constraints = intent_result.extracted_constraints or ""

        if intent_result.intent_type == IntentType.DOCUMENT_BRIEF:
            parsed = await loop.run_in_executor(
                self._executor, document_parser.parse, user_input
            )
            problem = parsed.problem
            context = parsed.context
            constraints = parsed.constraints
            yield DecisionEvent(
                type="document_parsed",
                content=f"已提取文档关键信息：{problem[:100]}",
            )

        # ---- Step 3: Prompt Optimization ----
        yield DecisionEvent(type="prompt_refining")

        optimized: OptimizedPrompt = await loop.run_in_executor(
            self._executor,
            prompt_optimizer.optimize,
            problem, context, constraints, intent_result.intent_type.value,
        )

        yield DecisionEvent(type="prompt_refined", optimized_prompt=optimized)

        # ---- Step 4: Multi-Agent Analysis (existing pipeline) ----
        async for event in self.decide(
            optimized.refined_problem,
            optimized.refined_context,
            optimized.refined_constraints,
        ):
            yield event

    def get_history(self) -> list[HistoryEntry]:
        return self.history


orchestrator = Orchestrator()
