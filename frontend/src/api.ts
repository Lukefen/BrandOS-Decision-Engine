import type { DecisionEvent, HistoryEntry } from './types';

const WS_URL = `ws://${window.location.host}/ws/decide`;
const API_URL = `http://${window.location.host}`;

export function connectDecisionSocket(
  input: string | { problem: string; context: string; constraints: string },
  onEvent: (event: DecisionEvent) => void,
  onError: (msg: string) => void,
  onClose: () => void,
): WebSocket {
  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    if (typeof input === 'string') {
      ws.send(JSON.stringify({ user_input: input }));
    } else {
      ws.send(JSON.stringify(input));
    }
  };

  ws.onmessage = (msg) => {
    try {
      const event: DecisionEvent = JSON.parse(msg.data);
      onEvent(event);
      // Only close on done/error if NOT awaiting clarification
      if (event.type === 'done' || event.type === 'error') {
        ws.close();
      }
    } catch {
      // ignore parse errors
    }
  };

  ws.onerror = () => onError('WebSocket 连接失败，请确认后端已启动');
  ws.onclose = onClose;

  return ws;
}

export function sendClarificationResponse(ws: WebSocket, answers: string[]): void {
  ws.send(JSON.stringify({ type: 'clarification_response', answers }));
}

export async function fetchHistory(): Promise<HistoryEntry[]> {
  const res = await fetch(`${API_URL}/api/history`);
  return res.json();
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  await fetch(`${API_URL}/api/history/${id}`, { method: 'DELETE' });
}

export async function updateApiConfig(apiKey: string, baseUrl: string, model: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, base_url: baseUrl, model }),
  });
  const data = await res.json();
  return data.ok;
}

export async function healthCheck(): Promise<{ status: string; llm_available: boolean; model: string }> {
  const res = await fetch(`${API_URL}/api/health`);
  return res.json();
}
