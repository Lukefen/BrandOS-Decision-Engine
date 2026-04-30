"""BrandOS Decision Engine — configuration."""

import os

# LLM API
API_PROVIDER = os.environ.get("API_PROVIDER", "DeepSeek")
API_KEY = os.environ.get(
    "DEEPSEEK_API_KEY",
    os.environ.get("OPENAI_API_KEY", "your-api-key-here"),
)
BASE_URL = os.environ.get("API_BASE_URL", "https://api.deepseek.com")
MODEL = os.environ.get("API_MODEL", "deepseek-chat")

# Agent pool
PARALLEL_AGENTS = [
    "brand_strategist",
    "market_analyst",
    "consumer_insight",
    "risk_assessor",
]

# Synthesis
SYNTHESIZER = "synthesizer"
MAX_TOKENS_PER_AGENT = 2000
TEMPERATURE = 0.7

# Intent detection & optimization
INTENT_MAX_TOKENS = 500
OPTIMIZER_MAX_TOKENS = 800
PARSER_MAX_TOKENS = 1000
