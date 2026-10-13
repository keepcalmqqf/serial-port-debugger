import { useCallback, useEffect, useState } from 'react'
import type { SerialManager } from '../serial/types'
import { BAUD_RATES, type ConnectionState, type PortConfig, defaultPortConfig } from '../serial/types'

interface Props {
  manager: SerialManager
  state: ConnectionState
  portLabel: string
  notice: string
  onPortLabelChange(label: string): void
  onNotice(msg: string): void
}

const STATE_TEXT: Record<ConnectionState, string> = {
  disconnected: '未连接',
  connecting: '连接中…',
  connected: '已连接',
}

function describePort(port: SerialPort): string {
  const info = port.getInfo()
  if (info.usbVendorId !== undefined) {
    const vid = info.usbVendorId.toString(16).padStart(4, '0').toUpperCase()
    const pid = (info.usbProductId ?? 0).toString(16).padStart(4, '0').toUpperCase()
    return `USB 串口 (VID:${vid} PID:${pid})`
  }
  return '串口设备'
}

export default function ConnectionPanel({ manager, state, portLabel, notice, onPortLabelChange, onNotice }: Props) {
  const [config, setConfig] = useState<PortConfig>(defaultPortConfig)
  const [baudCustom, setBaudCustom] = useState(false)

  // Web 模式：已授权的 Web Serial 端口
  const [ports, setPorts] = useState<SerialPort[]>([])
  const [portIndex, setPortIndex] = useState(-1)

  // 桌面模式：原生枚举到的端口
  const [nativePorts, setNativePorts] = useState<NativeSerialPortInfo[]>([])
  const [selectedPath, setSelectedPath] = useState('')

  const isNative = typeof window !== 'undefined' && !!window.serialNative
  const connected = state === 'connected'
  const busy = state === 'connecting'

  // ---------- 桌面端（serialport）：枚举端口 + 热插拔轮询 ----------
  const refreshNativePorts = useCallback(async () => {
    const bridge = window.serialNative
    if (!bridge) return
    const list = await bridge.list()
    setNativePorts(list)
    setSelectedPath((prev) => {
      const next = list.some((p) => p.path === prev) ? prev : (list[0]?.path ?? '')
      manager.setPortPath?.(next || null)
      onPortLabelChange(next)
      return next
    })
  }, [manager, onPortLabelChange])

  useEffect(() => {
    if (!isNative) return
    void refreshNativePorts()
  }, [isNative, refreshNativePorts])

  // 未连接时每 2 秒轮询一次端口列表，模拟热插拔感知
  useEffect(() => {
    if (!isNative || connected) return
    const timer = setInterval(() => void refreshNativePorts(), 2000)
    return () => clearInterval(timer)
  }, [isNative, connected, refreshNativePorts])

  // ---------- Web 端（Web Serial API）：授权端口列表 ----------
  const webManager = manager as unknown as import('../serial/SerialPortManager').SerialPortManager

  const refreshWebPorts = useCallback(async () => {
    try {
      const list = await webManager.getAuthorizedPorts()
      setPorts(list)
      // 当前选中的端口已不在列表中（设备被拔出且权限失效）时，重置选择
      const current = webManager.currentPort
      if (current && !list.includes(current)) {
        webManager.setPort(null)
        setPortIndex(-1)
        onPortLabelChange('')
      } else if (current) {
        // 列表刷新后顺序可能变化，同步下拉框选中项
        setPortIndex(list.indexOf(current))
      }
      if (list.length > 0 && !webManager.currentPort) {
        webManager.setPort(list[0])
        setPortIndex(0)
        onPortLabelChange(describePort(list[0]))
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webManager, onPortLabelChange])

  useEffect(() => {
    if (isNative) return
    void refreshWebPorts()
    // 热插拔：设备插入/拔出时自动刷新已授权端口列表
    const onHotPlug = (): void => {
      void refreshWebPorts()
    }
    navigator.serial.addEventListener('connect', onHotPlug)
    navigator.serial.addEventListener('disconnect', onHotPlug)
    return () => {
      navigator.serial.removeEventListener('connect', onHotPlug)
      navigator.serial.removeEventListener('disconnect', onHotPlug)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative])

  async function handleSelectPort() {
    try {
      await webManager.requestPort()
      if (webManager.currentPort) onPortLabelChange(describePort(webManager.currentPort))
      onNotice('')
      await refreshWebPorts()
    } catch (err) {
      // 用户取消选择器属正常，不提示
      if (err instanceof DOMException && err.name === 'NotFoundError') return
      onNotice(`选择串口失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleOpenClose() {
    if (connected || busy) {
      await manager.close()
      onNotice('串口已关闭')
      return
    }
    onNotice('')
    try {
      await manager.open(config)
    } catch (err) {
      onNotice(err instanceof Error ? err.message : String(err))
    }
  }

  const baudInList = BAUD_RATES.includes(config.baudRate)

  return (
    <section className="panel connection-panel">
      <div className="panel-row">
        <label className="field">
          <span>串口</span>
          {isNative ? (
            <div className="field-inline">
              <select
                className="select select-port"
                value={selectedPath}
                disabled={connected || busy}
                onChange={(e) => {
                  const path = e.target.value
                  setSelectedPath(path)
                  manager.setPortPath?.(path || null)
                  onPortLabelChange(path)
                }}
              >
                {nativePorts.length === 0 && <option value="">未发现串口设备</option>}
                {nativePorts.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button className="btn" onClick={() => void refreshNativePorts()} disabled={connected || busy}>
                刷新
              </button>
            </div>
          ) : (
            <div className="field-inline">
              <button className="btn" onClick={handleSelectPort} disabled={connected || busy}>
                选择串口
              </button>
              <select
                className="select"
                value={portIndex}
                disabled={connected || busy}
                onChange={(e) => {
                  const idx = Number(e.target.value)
                  if (ports[idx]) {
                    webManager.setPort(ports[idx])
                    setPortIndex(idx)
                    onPortLabelChange(describePort(ports[idx]))
                  }
                }}
              >
                <option value={-1}>已授权端口（{ports.length}）</option>
                {ports.map((p, i) => (
                  <option key={i} value={i}>
                    {describePort(p)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </label>

        <label className="field">
          <span>波特率</span>
          <div className="field-inline">
            <select
              className="select"
              disabled={connected || busy}
              value={baudCustom ? 'custom' : config.baudRate}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setBaudCustom(true)
                } else {
                  setBaudCustom(false)
                  setConfig({ ...config, baudRate: Number(e.target.value) })
                }
              }}
            >
              {BAUD_RATES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value="custom">自定义…</option>
            </select>
            {(baudCustom || !baudInList) && (
              <input
                className="input input-narrow"
                type="number"
                min={300}
                max={2000000}
                placeholder="300-2000000"
                disabled={connected || busy}
                value={config.baudRate || ''}
                onChange={(e) => setConfig({ ...config, baudRate: Number(e.target.value) || 0 })}
              />
            )}
          </div>
        </label>

        <label className="field">
          <span>数据位</span>
          <select
            className="select"
            disabled={connected || busy}
            value={config.dataBits}
            onChange={(e) => setConfig({ ...config, dataBits: Number(e.target.value) })}
          >
            {[5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>停止位</span>
          <select
            className="select"
            disabled={connected || busy}
            value={config.stopBits}
            onChange={(e) => setConfig({ ...config, stopBits: Number(e.target.value) })}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>

        <label className="field">
          <span>校验位</span>
          <select
            className="select"
            disabled={connected || busy}
            value={config.parity}
            onChange={(e) => setConfig({ ...config, parity: e.target.value as PortConfig['parity'] })}
          >
            <option value="none">无 (None)</option>
            <option value="even">偶 (Even)</option>
            <option value="odd">奇 (Odd)</option>
          </select>
        </label>

        <label className="field">
          <span>流控</span>
          <select
            className="select"
            disabled={connected || busy}
            value={config.flowControl}
            onChange={(e) => setConfig({ ...config, flowControl: e.target.value as PortConfig['flowControl'] })}
          >
            <option value="none">无</option>
            <option value="hardware">硬件 (RTS/CTS)</option>
          </select>
        </label>

        <div className="field field-status">
          <span>状态</span>
          <div className={`status-badge status-${state}`}>
            <i className="status-dot" />
            {STATE_TEXT[state]}
            {portLabel && connected && <em className="status-port">{portLabel}</em>}
          </div>
        </div>

        <button className={`btn btn-primary ${connected ? 'btn-danger' : ''}`} onClick={handleOpenClose} disabled={busy}>
          {busy ? '连接中…' : connected ? '关闭串口' : '打开串口'}
        </button>
      </div>
      {notice && <div className="notice">{notice}</div>}
    </section>
  )
}
