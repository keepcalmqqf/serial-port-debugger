import { contextBridge, ipcRenderer } from 'electron'

// 桌面端原生串口桥：渲染进程通过 window.serialNative 调用主进程的 serialport 实现
contextBridge.exposeInMainWorld('serialNative', {
  list(): Promise<unknown> {
    return ipcRenderer.invoke('serial-native:list')
  },
  open(path: string, config: unknown): Promise<unknown> {
    return ipcRenderer.invoke('serial-native:open', path, config)
  },
  write(data: Uint8Array): Promise<unknown> {
    return ipcRenderer.invoke('serial-native:write', data)
  },
  close(): Promise<unknown> {
    return ipcRenderer.invoke('serial-native:close')
  },
  onData(callback: (data: Uint8Array) => void): () => void {
    const listener = (_event: unknown, data: Uint8Array): void => callback(data)
    ipcRenderer.on('serial-native:data', listener)
    return () => ipcRenderer.removeListener('serial-native:data', listener)
  },
  onClosed(callback: (reason: string) => void): () => void {
    const listener = (_event: unknown, reason: string): void => callback(reason)
    ipcRenderer.on('serial-native:closed', listener)
    return () => ipcRenderer.removeListener('serial-native:closed', listener)
  }
})
