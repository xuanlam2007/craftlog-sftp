declare module 'sftp-watcher' {
  import { EventEmitter } from 'events'

  interface SftpWatcherOptions {
    host: string
    port?: number
    username: string
    password?: string
    privateKey?: string | Buffer
    path: string
    pollingInterval?: number
  }

  interface FileChangeData {
    file: string
    path: string
    timestamp: Date
  }

  class SftpWatcher extends EventEmitter {
    constructor(options: SftpWatcherOptions)
    
    on(event: 'upload', listener: (data: FileChangeData) => void): this
    on(event: 'delete', listener: (data: FileChangeData) => void): this
    on(event: 'error', listener: (error: Error) => void): this
    on(event: 'ready', listener: () => void): this
    
    emit(event: 'stop'): boolean
    emit(event: string, ...args: unknown[]): boolean
  }

  export = SftpWatcher
}
