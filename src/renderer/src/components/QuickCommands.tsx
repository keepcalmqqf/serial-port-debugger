import { useEffect, useState } from 'react'

export interface QuickCommand {
  id: number
  name: string
  text: string
  hex: boolean
}

interface Props {
  connected: boolean
  /** 当前输入框内容（用于"保存当前"） */
  currentText: string
  currentHex: boolean
  /** 点击指令：填入发送框 */
  onFill(text: string, hex: boolean): void
  /** 点击指令上的发送按钮：立即发送 */
  onSendNow(text: string, hex: boolean): void
}

const STORAGE_KEY = 'serial-debugger.quick-commands'

function loadCommands(): QuickCommand[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (c): c is QuickCommand =>
        typeof c === 'object' && c !== null && typeof c.name === 'string' && typeof c.text === 'string'
    )
  } catch {
    return []
  }
}

export default function QuickCommands({ connected, currentText, currentHex, onFill, onSendNow }: Props) {
  const [commands, setCommands] = useState<QuickCommand[]>(loadCommands)
  const [naming, setNaming] = useState(false)
  const [nameInput, setNameInput] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(commands))
  }, [commands])

  function saveCurrent() {
    const name = nameInput.trim()
    if (!name || !currentText) return
    setCommands((prev) => [...prev, { id: Date.now(), name, text: currentText, hex: currentHex }])
    setNameInput('')
    setNaming(false)
  }

  function remove(id: number) {
    setCommands((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="quick">
      <div className="quick-header">
        <span className="history-title">快捷指令：</span>
        {naming ? (
          <span className="quick-naming">
            <input
              className="input input-xs"
              placeholder="指令名称"
              value={nameInput}
              autoFocus
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveCurrent()
                if (e.key === 'Escape') setNaming(false)
              }}
            />
            <button className="btn btn-xs btn-primary" onClick={saveCurrent} disabled={!nameInput.trim() || !currentText}>
              保存
            </button>
            <button className="btn btn-xs" onClick={() => setNaming(false)}>
              取消
            </button>
          </span>
        ) : (
          <button
            className="btn btn-xs"
            onClick={() => setNaming(true)}
            disabled={!currentText}
            title={currentText ? '把当前发送框内容存为快捷指令' : '先在发送框输入内容'}
          >
            + 保存当前
          </button>
        )}
      </div>
      {commands.length > 0 && (
        <div className="quick-list">
          {commands.map((c) => (
            <span key={c.id} className="quick-item" title={`${c.hex ? '[HEX] ' : ''}${c.text}`}>
              <button className="quick-name" onClick={() => onFill(c.text, c.hex)}>
                {c.hex && <em className="quick-hex-tag">HEX</em>}
                {c.name}
              </button>
              <button
                className="quick-send"
                disabled={!connected}
                title="立即发送"
                onClick={() => onSendNow(c.text, c.hex)}
              >
                ▶
              </button>
              <button className="quick-del" title="删除" onClick={() => remove(c.id)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
