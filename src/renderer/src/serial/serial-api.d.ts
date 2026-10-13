// Web Serial API 类型声明（TypeScript 尚未内置）
// 参考：https://wicg.github.io/serial/

interface SerialPortInfo {
  readonly usbVendorId?: number
  readonly usbProductId?: number
}

interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null
  readonly writable: WritableStream<Uint8Array> | null
  open(options: SerialOptions): Promise<void>
  close(): Promise<void>
  getInfo(): SerialPortInfo
  forget?(): Promise<void>
  addEventListener(type: 'disconnect', listener: (event: Event) => void): void
  removeEventListener(type: 'disconnect', listener: (event: Event) => void): void
}

interface SerialOptions {
  baudRate: number
  dataBits?: number
  stopBits?: number
  parity?: 'none' | 'even' | 'odd'
  bufferSize?: number
  flowControl?: 'none' | 'hardware'
}

interface SerialPortRequestOptions {
  filters?: {
    usbVendorId?: number
    usbProductId?: number
  }[]
}

interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
  addEventListener(type: 'connect' | 'disconnect', listener: (event: Event) => void): void
  removeEventListener(type: 'connect' | 'disconnect', listener: (event: Event) => void): void
}

interface Navigator {
  readonly serial: Serial
}
