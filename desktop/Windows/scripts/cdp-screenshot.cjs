// Dev utility: captures PNG screenshots of every renderer page via CDP.
// Usage: node scripts/cdp-screenshot.cjs [port] [outDir]
const http = require('http')
const fs = require('fs')
const path = require('path')
const WebSocket = require('ws')

const port = process.argv[2] || '9333'
const outDir = process.argv[3] || path.join(__dirname, '..', 'shots')

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolve(JSON.parse(data)))
      })
      .on('error', reject)
  })
}

async function capture(target, index) {
  return new Promise((resolve) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 })
    let id = 0
    const pending = new Map()
    const send = (method, params = {}) =>
      new Promise((res) => {
        const msgId = ++id
        pending.set(msgId, res)
        ws.send(JSON.stringify({ id: msgId, method, params }))
      })
    ws.on('open', async () => {
      try {
        await send('Page.enable')
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
        const title = (target.title || `page${index}`).replace(/[^a-z0-9-]/gi, '_').slice(0, 40)
        const file = path.join(outDir, `${index}_${title}.png`)
        fs.writeFileSync(file, Buffer.from(shot.data, 'base64'))
        console.log('saved', file)
      } catch (e) {
        console.error('capture failed for', target.title, e.message)
      }
      ws.close()
      resolve()
    })
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg.result || {})
        pending.delete(msg.id)
      }
    })
    ws.on('error', () => resolve())
  })
}

;(async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const targets = await getJson(`http://127.0.0.1:${port}/json/list`)
  const pages = targets.filter((t) => t.type === 'page')
  if (pages.length === 0) {
    console.error('no pages found')
    process.exit(1)
  }
  for (let i = 0; i < pages.length; i++) await capture(pages[i], i)
})()
