"""BrandOS Decision Engine — FastAPI backend with WebSocket streaming."""

import asyncio
import json
import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from models.schemas import DecisionRequest, DecisionEvent
from core.orchestrator import orchestrator
from core.llm_client import llm
from config import API_KEY, BASE_URL, MODEL

app = FastAPI(title="BrandOS Decision Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- REST endpoints ----
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "llm_available": llm.available,
        "model": MODEL,
    }


@app.post("/api/config")
async def update_config(data: dict):
    api_key = data.get("api_key", "")
    base_url = data.get("base_url", BASE_URL)
    model = data.get("model", MODEL)
    if api_key:
        llm.update_api(api_key, base_url or BASE_URL, model or MODEL)
    return {"ok": llm.available, "model": llm.model}


@app.get("/api/history")
async def get_history():
    return [entry.model_dump() for entry in orchestrator.get_history()]


@app.delete("/api/history/{entry_id}")
async def delete_history(entry_id: str):
    orchestrator.history = [h for h in orchestrator.history if h.id != entry_id]
    return {"ok": True}


# ---- WebSocket for streaming decision ----
@app.websocket("/ws/decide")
async def ws_decide(ws: WebSocket):
    await ws.accept()

    try:
        # Receive the decision request
        raw = await ws.receive_text()
        data = json.loads(raw)

        # New conversational flow: {"user_input": "..."}
        user_input = data.get("user_input", "")

        if user_input:
            # ---- New pipeline: intent detection → optimization → agents ----
            clarification_round = 0
            current_input = user_input

            while True:
                clarification_answered = False

                async for event in orchestrator.run_full_pipeline(current_input, clarification_round):
                    await ws.send_json(event.model_dump())

                    # If clarification is needed, wait for the response
                    if event.type == "clarification_needed":
                        clarif_raw = await ws.receive_text()
                        clarif_data = json.loads(clarif_raw)
                        answers = clarif_data.get("answers", [])

                        # Merge answers back into the input
                        current_input = current_input + "\n\n补充信息：" + "\n".join(answers)
                        clarification_round += 1
                        clarification_answered = True
                        break  # Break inner loop to re-run pipeline with enriched input

                if not clarification_answered:
                    break  # Pipeline completed without needing clarification

        else:
            # ---- Legacy flow: {"problem", "context", "constraints"} ----
            problem = data.get("problem", "")
            context = data.get("context", "")
            constraints = data.get("constraints", "")

            if len(problem) < 10:
                await ws.send_json({
                    "type": "error",
                    "message": "问题描述至少需要 10 个字符",
                })
                await ws.close()
                return

            async for event in orchestrator.decide(problem, context, constraints):
                await ws.send_json(event.model_dump())

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass


# ---- HTTP SSE fallback ----
@app.post("/api/decide")
async def decide_http(req: DecisionRequest):
    """Non-streaming HTTP endpoint that runs the pipeline and returns full result."""
    from fastapi.responses import StreamingResponse

    user_input = getattr(req, 'user_input', None)

    async def event_stream():
        if user_input:
            async for event in orchestrator.run_full_pipeline(user_input):
                yield f"data: {json.dumps(event.model_dump(), ensure_ascii=False)}\n\n"
        else:
            async for event in orchestrator.decide(
                req.problem, req.context or "", req.constraints or ""
            ):
                yield f"data: {json.dumps(event.model_dump(), ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ---- Serve frontend in production ----
import os
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        index = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index):
            return FileResponse(index)
        return {"message": "Frontend not built. Run: cd frontend && npm run build"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
