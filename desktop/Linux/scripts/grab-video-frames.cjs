// Dev utility: play a local mp4 in a CDP-controlled browser, seek to a set of
// timestamps, and save a PNG frame at each. Used to extract reference frames
// from the Mac app's demo videos.
// Usage: node grab-video-frames.cjs <port> <fileUrlOfVideo> <outDir> <label> <t1,t2,...>
const http = require('http')
const fs = require('fs')
const path = require('path')
const WebSocket = require('ws')

const [, , port, videoUrl, outDir, label, tsArg] = process.argv
const timestamps = tsArg.split(',').map(Number)

function list() {
  return new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${port}/json/list`, (r) => {
      let d = ''
      r.on('data', (c) => (d += c))
      r.on('end', () => res(JSON.parse(d)))
    }).on('error', rej)
  })
}

;(async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const target = (await list()).find((t) => t.type === 'page' && (t.url || '').includes('player.html'))
  if (!target) {
    console.error('player.html page not found')
    process.exit(2)
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 })
  let id = 0
  const pending = new Map()
  const send = (method, params = {}) =>
    new Promise((res) => {
      const msgId = ++id
      pending.set(msgId, res)
      ws.send(JSON.stringify({ id: msgId, method, params }))
    })
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString())
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result || {})
      pending.delete(m.id)
    }
  })
  await new Promise((r) => ws.on('open', r))
  await send('Page.enable')
  await send('Runtime.enable')

  const dur = await send('Runtime.evaluate', {
    expression: `window.loadVid(${JSON.stringify(videoUrl)})`,
    awaitPromise: true,
    returnByValue: true
  })
  console.log('duration:', dur.result?.result?.value)

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  for (const t of timestamps) {
    await send('Runtime.evaluate', { expression: `window.seek(${t})`, awaitPromise: true, returnByValue: true })
    await sleep(400)
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    if (shot.data) {
      const file = path.join(outDir, `${label}_${String(t).replace('.', 'p')}s.png`)
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'))
      console.log('saved', file)
    }
  }
  ws.close()
  process.exit(0)
})()
