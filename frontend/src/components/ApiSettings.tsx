import { useState, useEffect } from 'react';
import { updateApiConfig, healthCheck } from '../api';

const PROVIDERS: Record<string, { base_url: string; models: string[] }> = {
  DeepSeek: { base_url: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner'] },
  OpenAI: { base_url: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o4-mini'] },
  'MiMo': { base_url: '', models: ['MiMo-V2.5-Pro'] },
  Custom: { base_url: '', models: [] },
};

interface Props {
  onClose: () => void;
  onSaved: (available: boolean, model: string) => void;
}

export function ApiSettings({ onClose, onSaved }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('DeepSeek');
  const [baseUrl, setBaseUrl] = useState(PROVIDERS.DeepSeek.base_url);
  const [model, setModel] = useState(PROVIDERS.DeepSeek.models[0]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'fail'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    // Check current status on mount
    healthCheck().then(h => {
      if (h.llm_available) {
        setStatus('ok');
        setStatusMsg(`已连接 — ${h.model}`);
      }
    }).catch(() => {});
  }, []);

  const handleProviderChange = (p: string) => {
    setProvider(p);
    const cfg = PROVIDERS[p];
    setBaseUrl(cfg.base_url);
    setModel(cfg.models[0] || '');
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setStatus('fail');
      setStatusMsg('请输入 API Key');
      return;
    }
    setSaving(true);
    setStatus('saving');
    setStatusMsg('测试连接中...');

    try {
      const ok = await updateApiConfig(apiKey.trim(), baseUrl.trim(), model.trim());
      if (ok) {
        setStatus('ok');
        setStatusMsg(`已激活 — ${model}`);
        onSaved(true, model);
        setTimeout(onClose, 1000);
      } else {
        setStatus('fail');
        setStatusMsg('连接失败，请检查配置');
        onSaved(false, '');
      }
    } catch {
      setStatus('fail');
      setStatusMsg('网络错误，请确认后端已启动');
      onSaved(false, '');
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>API 设置</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>API 服务商</label>
            <div className="provider-tabs">
              {Object.keys(PROVIDERS).map(p => (
                <button
                  key={p}
                  className={`provider-tab ${provider === p ? 'active' : ''}`}
                  onClick={() => handleProviderChange(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="输入你的 API Key..."
              autoFocus
            />
          </div>

          <div className="field">
            <label>Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com"
            />
          </div>

          <div className="field">
            <label>模型名称</label>
            {PROVIDERS[provider].models.length > 0 ? (
              <div className="model-select">
                {PROVIDERS[provider].models.map(m => (
                  <button
                    key={m}
                    className={`model-chip ${model === m ? 'active' : ''}`}
                    onClick={() => setModel(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="输入模型名称..."
              />
            )}
          </div>

          {status !== 'idle' && (
            <div className={`status-banner ${status}`}>
              {status === 'saving' && <span className="spinner-sm" />}
              {statusMsg}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || !apiKey.trim()}
          >
            {saving ? '连接中...' : '保存并激活'}
          </button>
        </div>
      </div>
    </div>
  );
}
