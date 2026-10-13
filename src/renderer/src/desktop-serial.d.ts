// 桌面端（Electron）preload 暴露的 window.serialNative 类型声明
// 主进程基于 serialport 包实现原生串口访问

interface NativeSerialPortInfo {
  /** 端口路径，如 /dev/cu.usbserial-XXXX 或 COM3 */
  path: string
  /** 展示名称，如 "/dev/cu.usbserial-XXXX · FTDI" */
  label: string
}

interface NativeSerialResult {
  ok: boolean
  error?: string
}

interface NativeSerialOpenConfig {
  baudRate: number
  dataBits: number
  stopBits: number
  parity: 'none' | 'even' | 'odd'
  flowControl: 'none' | 'hardware'
}

interface SerialNativeBridge {
  list(): Promise<NativeSerialPortInfo[]>
  open(path: string, config: NativeSerialOpenConfig): Promise<NativeSerialResult>
  write(data: Uint8Array): Promise<NativeSerialResult>
  close(): Promise<void>
  /** 收到串口数据 */
  onData(callback: (data: Uint8Array) => void): () => void
  /** 意外断开（设备拔出 / 串口错误），主动 close 不会触发 */
  onClosed(callback: (reason: string) => void): () => void
}

interface Window {
  serialNative?: SerialNativeBridge
}
