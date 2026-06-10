import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { app } from 'electron'
import { join } from 'path'
import { createInterface } from 'readline'

// Windows counterpart of Apple Vision OCR: a persistent Windows PowerShell 5.1
// sidecar running the built-in Windows.Media.Ocr engine (resources/ocr-worker.ps1).

interface Job {
  path: string
  resolve: (text: string | null) => void
}

class OcrService {
  private proc: ChildProcessWithoutNullStreams | null = null
  private queue: Job[] = []
  private inFlight: Job | null = null
  private ready = false
  private failedPermanently = false

  get pending(): number {
    return this.queue.length + (this.inFlight ? 1 : 0)
  }

  private scriptPath(): string {
    return app.isPackaged
      ? join(process.resourcesPath, 'resources', 'ocr-worker.ps1')
      : join(app.getAppPath(), 'resources', 'ocr-worker.ps1')
  }

  private ensureProcess(): void {
    if (this.proc || this.failedPermanently) return
    const proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath()],
      { windowsHide: true, stdio: 'pipe' }
    )
    this.proc = proc
    const rl = createInterface({ input: proc.stdout })
    rl.on('line', (line) => this.handleLine(line))
    proc.stderr.on('data', () => {})
    proc.on('exit', (code) => {
      this.proc = null
      this.ready = false
      if (this.inFlight) {
        this.inFlight.resolve(null)
        this.inFlight = null
      }
      if (code !== 0 && this.queue.length === 0) return
      // restart lazily on next job
    })
  }

  private handleLine(line: string): void {
    let parsed: { ok: boolean; ready?: boolean; fatal?: boolean; text?: string; error?: string }
    try {
      parsed = JSON.parse(line)
    } catch {
      return
    }
    if (parsed.ready) {
      this.ready = true
      this.pump()
      return
    }
    if (parsed.fatal) {
      this.failedPermanently = true
      console.error('ocr: engine unavailable:', parsed.error)
      this.drainAll(null)
      return
    }
    const job = this.inFlight
    this.inFlight = null
    job?.resolve(parsed.ok ? (parsed.text ?? '') : null)
    this.pump()
  }

  private drainAll(result: string | null): void {
    this.inFlight?.resolve(result)
    this.inFlight = null
    for (const j of this.queue.splice(0)) j.resolve(result)
  }

  private pump(): void {
    if (this.inFlight || !this.proc || !this.ready) return
    const job = this.queue.shift()
    if (!job) return
    this.inFlight = job
    this.proc.stdin.write(job.path + '\n')
  }

  recognize(path: string): Promise<string | null> {
    if (this.failedPermanently) return Promise.resolve(null)
    this.ensureProcess()
    return new Promise((resolve) => {
      this.queue.push({ path, resolve })
      this.pump()
    })
  }

  dispose(): void {
    this.drainAll(null)
    this.proc?.kill()
    this.proc = null
  }
}

export const ocrService = new OcrService()
