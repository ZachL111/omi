// Walk the PACKAGED app: navigate by clicking the real sidebar buttons (by title)
// over CDP and screenshot each screen. No dev-only hooks (those are stripped from
// production); this exercises the actual navigation.
// Usage: node scripts/pkg-shoot.cjs <port> <outDir>
const http = require('http')
const fs = require('fs')
const path = require('path')
const WebSocket = require('ws')

const port = process.argv[2]
const outDir = process.argv[3]

// [filename, sidebar button title]
const PAGES = [
  ['dashboard', 'Dashboard'],
  ['conversations', 'Conversations'],
  ['chat', 'Chat'],
  ['memories', 'Memories'],
  ['tasks', 'Tasks'],
  ['rewind', 'Rewind'],
  ['apps', 'Apps'],
  ['goals', 'Goals'],
  ['focus', 'Focus'],
  ['insights', 'Insights'],
  ['graph', 'Graph'],
  ['persona', 'AI Persona'],
  ['settings', 'Settings']
]

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
  const targets = await list()
  // Main window = the page target loading index.html (not the floating bar or glow overlay).
  const target =
    targets.find((t) => t.type === 'page' && /index\.html/.test(t.url) && !/floating|glow/.test(t.url)) ||
    targets.find((t) => t.type === 'page' && !/floating|glow|devtools/.test(t.url))
  if (!target) {
    console.log('NO main target. targets:', targets.map((t) => `${t.type}:${t.url}`).join(' | '))
    process.exit(2)
  }
  console.log('main target:', target.url)
  const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 })
  let id = 0
  const pending = new Map()
  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id
      pending.set(i, res)
      ws.send(JSON.stringify({ id: i, method, params }))
    })
  const errors = []
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString())
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result || {})
      pending.delete(m.id)
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push((m.params.args || []).map((a) => a.value || a.description || '').join(' '))
    } else if (m.method === 'Runtime.exceptionThrown') {
      errors.push('EXCEPTION: ' + (m.params.exceptionDetails && m.params.exceptionDetails.text))
    }
  })
  await new Promise((r) => ws.on('open', r))
  await send('Page.enable')
  await send('Runtime.enable')
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  for (const [file, title] of PAGES) {
    const clicked = await send('Runtime.evaluate', {
      expression: `(() => { const b = document.querySelector('button[title=${JSON.stringify(title)}]'); if (b) { b.click(); return true } return false })()`,
      returnByValue: true
    })
    await sleep(1500)
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(outDir, `${file}.png`), Buffer.from(shot.data, 'base64'))
    console.log('saved', file, '(nav clicked:', clicked && clicked.result && clicked.result.value, ')')
  }
  if (errors.length) {
    console.log('CONSOLE ERRORS (' + errors.length + '):')
    errors.slice(0, 20).forEach((e) => console.log('  ', e))
  } else {
    console.log('NO console errors during walkthrough')
  }
  ws.close()
  process.exit(0)
})()
