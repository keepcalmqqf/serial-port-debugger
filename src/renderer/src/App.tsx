import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSerialManager } from './serial/createSerialManager'
import type { ConnectionState, SerialManager } from './serial/types'
import { bytesToHex, bytesToText, timestamp } from './serial/utils'
import ConnectionPanel from './components/ConnectionPanel'
import ReceivePanel from './components/ReceivePanel'
import SendPanel from './components/SendPanel'
import StatusBar from './components/StatusBar'

export interface ReceiveEntry {
  time: string
  hex: string
  text: string
  bytes: number
}

export interface DisplayOptions {
  mode: 'hex' | 'text'
  showTimestamp: boolean
  autoScroll: boolean
  paused: boolean
}

export interface SendOptions {
  mode: 'hex' | 'text'
  newline: 'none' | 'LF' | 'CR' | 'CRLF'
  intervalMs: number
  autoSend: boolean
}

const MAX_ENTRIES = 2000

function isSerialSupported(): boolean {
  // 桌面端走原生串口桥，不依赖 Web Serial API
  if (typeof window !== 'undefined' && window.serialNative) return true
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

export default function App() {
  const supported = useMemo(isSerialSupported, [])
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [portLabel, setPortLabel] = useState<string>('')
  const [notice, setNotice] = useState<string>('') // 错误 / 断开提示
  const [rxCount, setRxCount] = useState(0)
  const [txCount, setTxCount] = useState(0)
  const [entries, setEntries] = useState<ReceiveEntry[]>([])
  const [display, setDisplay] = useState<DisplayOptions>({
    mode: 'text',
    showTimestamp: false,
    autoScroll: true,
    paused: false,
  })
  const [sendOptions, setSendOptions] = useState<SendOptions>({
    mode: 'text',
    newline: 'none',
    intervalMs: 1000,
    autoSend: false,
  })
  const [history, setHistory] = useState<string[]>([])
  const [sendText, setSendText] = useState('')

  const isDesktop = typeof window !== 'undefined' && !!window.serialNative

  // 暂停时数据仍累积在 ref 中，恢复时一次性渲染
  const pendingRef = useRef<ReceiveEntry[]>([])
  const displayRef = useRef(display)
  displayRef.current = display

  const managerRef = useRef<SerialManager | null>(null)
  if (!managerRef.current) {
    managerRef.current = createSerialManager({
      onData(data) {
        setRxCount((c) => c + data.length)
        const entry: ReceiveEntry = {
          time: timestamp(),
          hex: bytesToHex(data),
          text: bytesToText(data),
          bytes: data.length,
        }
        if (displayRef.current.paused) {
          pendingRef.current.push(entry)
          if (pendingRef.current.length > MAX_ENTRIES) {
            pendingRef.current.splice(0, pendingRef.current.length - MAX_ENTRIES)
          }
          return
        }
        setEntries((prev) => {
          const next = [...prev, entry]
          return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
        })
      },
      onStateChange(state) {
        setConnectionState(state)
        if (state === 'connected') setNotice('')
      },
      onDisconnect(reason) {
        setNotice(reason ?? '连接已断开')
        setSendOptions((s) => (s.autoSend ? { ...s, autoSend: false } : s))
      },
    })
  }
  const manager = managerRef.current

  useEffect(() => {
    return () => {
      void managerRef.current?.close()
    }
  }, [])

  const flushPending = useCallback(() => {
    if (pendingRef.current.length > 0) {
      setEntries((prev) => {
        const next = [...prev, ...pendingRef.current]
        pendingRef.current = []
        return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
      })
    }
  }, [])

  const togglePause = useCallback(() => {
    setDisplay((d) => {
      if (d.paused) {
        // 恢复显示：立即渲染暂停期间累积的数据
        queueMicrotask(flushPending)
        return { ...d, paused: false }
      }
      return { ...d, paused: true }
    })
  }, [flushPending])

  const doSend = useCallback(
    async (payload: Uint8Array) => {
      if (payload.length === 0) return
      try {
        await manager.write(payload)
        setTxCount((c) => c + payload.length)
      } catch (err) {
        setNotice(`发送失败：${err instanceof Error ? err.message : String(err)}`)
        setSendOptions((s) => ({ ...s, autoSend: false }))
      }
    },
    [manager],
  )

  const recordHistory = useCallback((text: string) => {
    setHistory((prev) => [text, ...prev.filter((h) => h !== text)].slice(0, 20))
  }, [])

  const clearReceive = useCallback(() => {
    pendingRef.current = []
    setEntries([])
    setRxCount(0)
  }, [])

  if (!supported) {
    return (
      <div className="unsupported-page">
        <div className="unsupported-card">
          <h1>浏览器不支持 Web Serial API</h1>
          <p>
            本工具基于浏览器 <code>navigator.serial</code>（Web Serial API）实现，
            当前浏览器未提供该能力，无法使用串口通信功能。
          </p>
          <h2>如何启用</h2>
          <ul>
            <li>使用基于 Chromium 的浏览器：<strong>Google Chrome</strong> / <strong>Microsoft Edge</strong>（版本 89 及以上），桌面版</li>
            <li>Opera、Brave 等 Chromium 内核浏览器也可使用</li>
            <li>Firefox、Safari 目前不支持 Web Serial API</li>
            <li>注意：iOS/iPadOS 上的浏览器均不支持，需要 macOS / Windows / Linux / Android 桌面或设备</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <svg
          className="app-logo"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 17l6-6-6-6" />
          <path d="M12 19h8" />
        </svg>
        <h1>串口调试工具</h1>
        <span className="app-header-sub">
          {isDesktop ? '桌面版 · Electron' : 'Web Serial · 浏览器直连串口'}
        </span>
      </header>
      <ConnectionPanel
        manager={manager}
        state={connectionState}
        portLabel={portLabel}
        notice={notice}
        onPortLabelChange={setPortLabel}
        onNotice={setNotice}
      />
      <main className="app-main">
        <ReceivePanel
          entries={entries}
          display={display}
          rxCount={rxCount}
          connected={connectionState === 'connected'}
          onDisplayChange={setDisplay}
          onTogglePause={togglePause}
          onClear={clearReceive}
        />
        <SendPanel
          manager={manager}
          connected={connectionState === 'connected'}
          sendText={sendText}
          options={sendOptions}
          history={history}
          onSendTextChange={setSendText}
          onOptionsChange={setSendOptions}
          onSend={doSend}
          onRecordHistory={recordHistory}
        />
      </main>
      <StatusBar state={connectionState} rxCount={rxCount} txCount={txCount} portLabel={portLabel} />
    </div>
  )
}
