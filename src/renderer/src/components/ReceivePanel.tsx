import { useEffect, useMemo, useRef } from 'react'
import type { DisplayOptions, ReceiveEntry } from '../App'
import { downloadTextFile, timestamp } from '../serial/utils'

interface Props {
  entries: ReceiveEntry[]
  display: DisplayOptions
  rxCount: number
  connected: boolean
  onDisplayChange(options: DisplayOptions): void
  onTogglePause(): void
  onClear(): void
}

export default function ReceivePanel({
  entries,
  display,
  rxCount,
  connected,
  onDisplayChange,
  onTogglePause,
  onClear,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (display.autoScroll && !display.paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries, display.autoScroll, display.paused])

  const lines = useMemo(
    () =>
      entries.map((e) => ({
        time: e.time,
        body: display.mode === 'hex' ? e.hex : e.text,
      })),
    [entries, display.mode],
  )

  function handleExport() {
    const header = `# 串口日志导出  ${timestamp()}\n# 显示模式: ${display.mode.toUpperCase()}\n\n`
    const text = lines
      .map((l) => (display.showTimestamp ? `[${l.time}] ${l.body}` : l.body))
      .join('\n')
    downloadTextFile(`serial-log-${Date.now()}.txt`, header + text)
  }

  return (
    <section className="panel receive-panel">
      <div className="panel-toolbar">
        <h2>接收区</h2>
        <div className="toolbar-group">
          <div className="segmented">
            <button
              className={display.mode === 'text' ? 'active' : ''}
              onClick={() => onDisplayChange({ ...display, mode: 'text' })}
            >
              文本
            </button>
            <button
              className={display.mode === 'hex' ? 'active' : ''}
              onClick={() => onDisplayChange({ ...display, mode: 'hex' })}
            >
              HEX
            </button>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={display.showTimestamp}
              onChange={(e) => onDisplayChange({ ...display, showTimestamp: e.target.checked })}
            />
            时间戳
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={display.autoScroll}
              onChange={(e) => onDisplayChange({ ...display, autoScroll: e.target.checked })}
            />
            自动滚动
          </label>
          <button className={`btn btn-sm ${display.paused ? 'btn-warning' : ''}`} onClick={onTogglePause}>
            {display.paused ? '继续显示' : '暂停显示'}
          </button>
          <button className="btn btn-sm" onClick={onClear}>
            清空
          </button>
          <button className="btn btn-sm" onClick={handleExport}>
            导出日志
          </button>
        </div>
      </div>
      <div className={`receive-view ${display.paused ? 'is-paused' : ''}`} ref={scrollRef}>
        {lines.length === 0 ? (
          <div className="receive-empty">
            {connected ? '等待数据…' : '尚未连接串口，打开串口后开始接收数据'}
          </div>
        ) : (
          lines.map((line, i) => (
            <pre key={i} className="receive-line">
              {display.showTimestamp && <span className="line-time">[{line.time}] </span>}
              {line.body || ' '}
            </pre>
          ))
        )}
        {display.paused && <div className="paused-hint">显示已暂停（数据仍在后台接收）</div>}
      </div>
      <div className="panel-footer">
        <span>
          已接收 <strong>{rxCount}</strong> 字节
          {entries.length >= 2000 && <span className="warn">（已达显示上限，旧数据被丢弃）</span>}
        </span>
      </div>
    </section>
  )
}
