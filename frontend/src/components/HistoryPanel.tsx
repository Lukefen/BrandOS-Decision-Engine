import { useState, useEffect } from 'react';
import type { HistoryEntry } from '../types';

interface Props {
  onLoad: (entry: HistoryEntry) => void;
  fetchHistory: () => Promise<HistoryEntry[]>;
  deleteEntry: (id: string) => Promise<void>;
}

export function HistoryPanel({ onLoad, fetchHistory, deleteEntry }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchHistory();
      setEntries(data.reverse()); // newest first
    } catch {
      // ignore fetch errors
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  if (loading) return <div className="history-panel"><p>加载中...</p></div>;

  if (entries.length === 0) {
    return (
      <div className="history-panel empty">
        <p>暂无历史决策记录</p>
        <p className="hint">完成一次多 Agent 分析后，结果将保存在这里</p>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <h2>历史决策记录</h2>
      <div className="history-list">
        {entries.map(entry => (
          <div key={entry.id} className="history-card">
            <div className="history-card-header">
              <span className="history-time">{entry.timestamp}</span>
              <div className="history-card-actions">
                <button
                  className="btn-ghost-sm"
                  onClick={() => onLoad(entry)}
                >
                  查看详情
                </button>
                <button
                  className="btn-ghost-sm danger"
                  onClick={() => handleDelete(entry.id)}
                >
                  删除
                </button>
              </div>
            </div>
            <div className="history-card-body">
              <p className="history-problem">{entry.problem.slice(0, 150)}{entry.problem.length > 150 ? '...' : ''}</p>
              <div className="history-meta">
                <span>{entry.agents.length} 位专家参与</span>
                <span>置信度 {(entry.synthesis.confidence * 100).toFixed(0)}%</span>
                {entry.synthesis.options[0] && (
                  <span>推荐: {entry.synthesis.options[0].option.slice(0, 40)}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
