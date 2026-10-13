import type { SerialManager } from './types'
import { NativeSerialManager } from './NativeSerialManager'
import { SerialPortManager, type SerialEvents } from './SerialPortManager'

/**
 * 按运行环境选择串口实现：
 * 桌面端（Electron preload 注入了 serialNative）走 serialport 原生实现；
 * 浏览器环境回退到 Web Serial API。
 */
export function createSerialManager(events: SerialEvents): SerialManager {
  if (typeof window !== 'undefined' && window.serialNative) {
    return new NativeSerialManager(events)
  }
  return new SerialPortManager(events)
}
