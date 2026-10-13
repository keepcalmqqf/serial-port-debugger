# 串口调试工具

一款现代化的串口调试桌面工具。基于 **Electron + electron-vite + React + TypeScript**。

串口通信采用双实现：桌面端（Electron）使用 **serialport** 原生模块（主进程直接读写串口，经 IPC 桥接到渲染层）；在浏览器中打开时自动回退到 **Web Serial API**。

## 功能

- 串口连接：端口下拉自动枚举（含厂商信息）、波特率（含自定义）、数据位、停止位、校验位、硬件流控
- 热插拔感知：桌面端未连接时定时轮询端口列表，设备拔出自动断开并提示；Web 端监听 connect/disconnect 事件
- 接收区：文本 / HEX 显示切换、时间戳、自动滚动、暂停显示、清空、导出日志、接收字节统计
- 发送区：文本 / HEX 模式、追加换行（LF / CR / CRLF）、定时发送、Enter 快捷发送、发送历史
- 快捷指令：常用指令一键填入或立即发送，localStorage 持久化
- 状态栏：连接状态、RX / TX 字节计数

## 开发

```bash
npm install

# 桌面端开发模式（主进程 / preload / 渲染进程统一构建，渲染层热更新）
npm run dev
```

## 构建与打包

```bash
# 类型检查 + 构建三端产物到 out/
npm run build

# 以桌面应用运行 out/ 产物
npm start

# 打包安装包（macOS: dmg + zip；输出到 release/）
npm run pack

# 只打包为免安装目录（快速验证）
npm run pack:dir
```

> 打包默认跳过代码签名。分发 macOS 未签名应用时，首次打开需在「系统设置 → 隐私与安全性」中允许。
> Windows / Linux 目标已在 `package.json` 的 `build` 字段中预置（nsis / AppImage），在对应平台上执行 `npm run pack` 即可。

## 目录结构

```
electron.vite.config.ts   electron-vite 配置（main / preload / renderer 三段）
src/
  main/index.ts           Electron 主进程：窗口、serialport 串口读写、IPC 处理
  preload/index.ts        contextBridge 暴露 window.serialNative 桥接 API
  renderer/
    index.html
    src/
      App.tsx                应用状态与布局
      components/            ConnectionPanel / ReceivePanel / SendPanel / StatusBar / QuickCommands
      serial/
        createSerialManager.ts 按环境选择原生 / Web Serial 实现
        NativeSerialManager.ts  桌面端实现（经 IPC 调用主进程 serialport）
        SerialPortManager.ts    Web Serial API 封装（打开/关闭、读取循环、写入、拔出监听）
        types.ts                串口参数类型与常量
        utils.ts                HEX 与文本转换工具
```

## 技术要点

- 桌面端串口在主进程由 `serialport` 直接管理：枚举（含厂商/友好名称）、打开、读写、关闭，
  数据与断开事件经 IPC 推送渲染层；preload 通过 contextBridge 暴露 `window.serialNative`。
- 渲染层定义统一的 `SerialManager` 接口，`createSerialManager` 检测到 `window.serialNative`
  时使用原生实现，否则回退 Web Serial API（浏览器版行为不变）。
- `serialport` 为原生模块：`postinstall` 通过 `@electron/rebuild` 按 Electron ABI 重建，
  打包时 `asarUnpack: ["**/*.node"]` 解包原生二进制（electron-builder 打包时会再次自动重建）。
- 主进程与 preload 以 CJS 产物输出（sandbox 下的 preload 不支持 ESM），因此 package.json
  不设置 `"type": "module"`。
