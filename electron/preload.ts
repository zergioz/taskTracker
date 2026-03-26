const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform
})

contextBridge.exposeInMainWorld('electronStore', {
  get: (key: string) => ipcRenderer.invoke('store:get', key),
  set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
})
