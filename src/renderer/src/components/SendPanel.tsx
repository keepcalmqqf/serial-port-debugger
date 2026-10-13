import { useEffect, useMemo } from 'react'
import type { SendOptions } from '../App'
import type { SerialManager } from '../serial/types'
import { NEWLINE_SUFFIX, type NewlineSuffix } from '../serial/types'
import { hexStringToBytes } from '../serial/utils'
import QuickCommands from './QuickCommands'

interface Props {
  manager: SerialManager
  connected: boolean
  sendText: string
  options: SendOptions
  history: string[]
  onSendTextChange(text: string): void
  onOptionsChange(options: SendOptions): void
  onSend(payload: Uint8Array): Promise<void>
  onRecordHistory(text: string): void
}

const encoder = new TextEncoder()

function buildPayload(text: string, options: SendOptions): { payload: Uint8Array; error?: string } {
  if (options.mode === 'hex') {
    const bytes = hexStringToBytes(text)
    if (!bytes) return { payload: new Uint8Array(0), error: 'HEX 格式错误：请输入十六进制字节，如 48 65 6C 6C 6F' }
    const suffix = options.newline === 'none' ? new Uint8Array(0)
      : options.newline === 'LF' ? new Uint8Array([0x0a])
      : options.newline === 'CR' ? new Uint8Array([0x0d])
      : new Uint8Array([0x0d, 0x0a])
    const payload = new Uint8Array(bytes.length + suffix.length)
    payload.set(bytes)
    payload.set(suffix, bytes.length)
    return { payload }
  }
  return { payload: encoder.encode(text + NEWLINE_SUFFIX[options.newline as NewlineSuffix]) }
}

export default function SendPanel({
  connected,
  sendText,
  options,
  history,
  onSendTextChange,
  onOptionsChange,
  onSend,
  onRecordHistory,
}: Props) {
  const { payload, error } = useMemo(() => buildPayload(sendText, options), [sendText, options])
  const canSend = connected && payload.length > 0 && !error

  async function handleSend() {
    if (!canSend) return
    await onSend(payload)
    onRecordHistory(sendText)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 发送，Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void handleSend()
    }
  }

  function handleFill(text: string, hex: boolean) {
    onSendTextChange(text)
    onOptionsChange({ ...options, mode: hex ? 'hex' : 'text' })
  }

  async function handleSendNow(text: string, hex: boolean) {
    if (!connected) return
    const opts: SendOptions = { ...options, mode: hex ? 'hex' : 'text' }
    const { payload: p, error: err } = buildPayload(text, opts)
    if (err || p.length === 0) return
    await onSend(p)
    onRecordHistory(text)
  }

  // 定时自动发送
  useEffect(() => {
    if (!options.autoSend || !connected || !canSend) return
    const timer = setInterval(() => {
      void onSend(buildPayload(sendText, options).payload)
    }, Math.max(50, options.intervalMs))
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.autoSend, options.intervalMs, connected, canSend, sendText, options])

  return (
    <section className="panel send-panel">
      <div className="panel-toolbar">
        <h2>发送区</h2>
        <div className="toolbar-group">
          <div className="segmented">
            <button
              className={options.mode === 'text' ? 'active' : ''}
              onClick={() => onOptionsChange({ ...options, mode: 'text' })}
            >
              文本
            </button>
            <button
              className={options.mode === 'hex' ? 'active' : ''}
              onClick={() => onOptionsChange({ ...options, mode: 'hex' })}
            >
              HEX
            </button>
          </div>
          <label className="check">
            追加换行
            <select
              className="select select-sm"
              value={options.newline}
              onChange={(e) => onOptionsChange({ ...options, newline: e.target.value as SendOptions['newline'] })}
            >
              <option value="none">无</option>
              <option value="LF">LF (\n)</option>
              <option value="CR">CR (\r)</option>
              <option value="CRLF">CRLF (\r\n)</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={options.autoSend}
              disabled={!connected}
              onChange={(e) => onOptionsChange({ ...options, autoSend: e.target.checked })}
            />
            定时发送
          </label>
          {options.autoSend && (
            <label className="check">
              间隔
              <input
                className="input input-xs"
                type="number"
                min={50}
                step={50}
                value={options.intervalMs}
                onChange={(e) => onOptionsChange({ ...options, intervalMs: Number(e.target.value) || 1000 })}
              />
              ms
            </label>
          )}
        </div>
      </div>
      <textarea
        className="send-input"
        placeholder={options.mode === 'hex' ? '输入十六进制字节，如：48 65 6C 6C 6F' : '输入要发送的内容，Enter 发送，Shift+Enter 换行'}
        value={sendText}
        onChange={(e) => onSendTextChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
      {error && <div className="send-error">{error}</div>}
      <div className="panel-footer send-footer">
        <span className="hint">
          {options.mode === 'hex' ? `${payload.length} 字节` : `${sendText.length} 字符`} · {connected ? '已连接' : '未连接'}
        </span>
        <button className="btn btn-primary" onClick={() => void handleSend()} disabled={!canSend}>
          发送
        </button>
      </div>
      {history.length > 0 && (
        <div className="history">
          <span className="history-title">历史记录（点击重新填入）：</span>
          <div className="history-list">
            {history.map((h, i) => (
              <button key={i} className="history-item" title={h} onClick={() => onSendTextChange(h)}>
                {h.length > 40 ? h.slice(0, 40) + '…' : h}
              </button>
            ))}
          </div>
        </div>
      )}
      <QuickCommands
        connected={connected}
        currentText={sendText}
        currentHex={options.mode === 'hex'}
        onFill={handleFill}
        onSendNow={(text, hex) => void handleSendNow(text, hex)}
      />
    </section>
  )
}
