"""Unified LLM client — OpenAI-compatible API."""

from openai import OpenAI
from config import API_KEY, BASE_URL, MODEL, MAX_TOKENS_PER_AGENT, TEMPERATURE


class LLMClient:
    def __init__(self):
        self.client = None
        if API_KEY and API_KEY != "your-api-key-here":
            self.client = OpenAI(api_key=API_KEY, base_url=BASE_URL)
        self.model = MODEL

    def update_api(self, api_key: str, base_url: str, model: str):
        self.model = model
        self.client = OpenAI(api_key=api_key, base_url=base_url)

    @property
    def available(self) -> bool:
        return self.client is not None

    def chat(self, system: str, user: str, temperature: float = TEMPERATURE) -> str:
        """Single-turn chat completion."""
        if not self.client:
            return ""
        resp = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=temperature,
            max_tokens=MAX_TOKENS_PER_AGENT,
        )
        return resp.choices[0].message.content or ""

    def chat_stream(self, system: str, user: str):
        """Streaming chat completion — yields text chunks."""
        if not self.client:
            yield ""
            return
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=TEMPERATURE,
            max_tokens=MAX_TOKENS_PER_AGENT,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


llm = LLMClient()
