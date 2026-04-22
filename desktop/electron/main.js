const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs   = require('fs')
const http = require('http')

// Load .env into process.env — Vite handles this for the renderer, but the
// Electron main process runs as plain Node and never sees Vite's env injection.
try {
  const envFile = path.join(__dirname, '../.env')
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const eq = line.indexOf('=')
    if (eq < 1) return
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim()
    if (key && !process.env[key]) process.env[key] = val
  })
} catch { /* .env absent in production — fine */ }

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const API_BASE = process.env.API_URL || process.env.VITE_API_URL || 'https://lphub.lostpuppies.org'

let mainWindow

// ── Custom protocol: lphub:// ───────────────────────────────────────────────
// Registers the app as handler for lphub:// deep links.
// In dev: pass execPath + script path so Windows registry points to the
//         running electron binary, not a packaged executable.
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient('lphub', process.execPath, [path.resolve(process.argv[1])])
} else {
  app.setAsDefaultProtocolClient('lphub')
}

// Pending Discord OAuth callback (system-browser flow)
let _pendingDiscord = null
let _oauthServer    = null

// Starts a one-shot local HTTP server on a random port.
// Backend will redirect to http://127.0.0.1:PORT/discord-callback?discord_token=XXX
function startOAuthServer() {
  return new Promise((resolve, reject) => {
    if (_oauthServer) { _oauthServer.close(); _oauthServer = null }

    const server = http.createServer((req, res) => {
      try {
        const u = new URL(req.url, 'http://127.0.0.1')
        if (u.pathname !== '/discord-callback') { res.writeHead(404); res.end(); return }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<html><body style="background:#0f0f0f;color:#fafaf9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>Login complete — you can close this tab.</p></body></html>')

        server.close()
        _oauthServer = null

        const token = u.searchParams.get('discord_token')
        const error = u.searchParams.get('discord_error')
        console.log('[oauth-server] callback — token:', !!token, '| error:', error)

        if (_pendingDiscord) {
          const { resolve: ok, reject: fail, timer } = _pendingDiscord
          clearTimeout(timer)
          _pendingDiscord = null
          if (token) ok({ token })
          else fail(new Error(error || 'auth_failed'))
        }

        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.focus()
        }
      } catch (e) {
        console.error('[oauth-server] error:', e)
        res.writeHead(500); res.end()
      }
    })

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      _oauthServer = server
      resolve(server.address().port)
    })
  })
}

function handleProtocolUrl(url) {
  console.log('[lphub] protocol url received:', url)
  try {
    const u = new URL(url)
    if (u.hostname !== 'auth') { console.log('[lphub] hostname mismatch:', u.hostname); return }
    if (!_pendingDiscord) { console.log('[lphub] no pending discord promise — ignoring'); return }
    const { resolve, reject, timer } = _pendingDiscord
    clearTimeout(timer)
    _pendingDiscord = null
    const token = u.searchParams.get('discord_token')
    const error = u.searchParams.get('discord_error')
    console.log('[lphub] token present:', !!token, '| error:', error)
    if (token) resolve({ token })
    else reject(new Error(error || 'auth_failed'))
  } catch (e) {
    console.error('[lphub] parse error:', e)
  }
}

// macOS — app receives open-url event
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleProtocolUrl(url)
})

// Windows / Linux — second instance receives protocol URL via argv
const gotInstanceLock = app.requestSingleInstanceLock()
if (!gotInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_evt, argv) => {
    console.log('[second-instance] argv:', argv)
    const protoUrl = argv.find(a => a.startsWith('lphub://'))
    if (protoUrl) handleProtocolUrl(protoUrl)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0F0F0F',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  if (!gotInstanceLock) return   // second instance — just quit, no window
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Window controls ────────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)

// ── electron-store ─────────────────────────────────────────────────────────
let Store
async function getStore() {
  if (!Store) {
    const mod = await import('electron-store')
    Store = new mod.default()
  }
  return Store
}

ipcMain.handle('store:get', async (_, key) => { const s = await getStore(); return s.get(key) })
ipcMain.handle('store:set', async (_, key, value) => { const s = await getStore(); s.set(key, value) })
ipcMain.handle('store:delete', async (_, key) => { const s = await getStore(); s.delete(key) })
ipcMain.handle('app:version', () => app.getVersion())

// ── Discord OAuth — local HTTP server flow ────────────────────────────────
// Opens the system browser. Electron starts a one-shot local HTTP server and
// passes the port to the backend as ?port=XXXXX. Backend redirects to
// http://127.0.0.1:PORT/discord-callback?discord_token=XXX after Discord auth.
// No custom protocol / registry required — works in dev and packaged.
ipcMain.handle('discord:auth', async (_, { action, inviteCode }) => {
  return new Promise(async (resolve, reject) => {
    // Cancel any in-flight request
    if (_pendingDiscord) {
      clearTimeout(_pendingDiscord.timer)
      _pendingDiscord.reject(new Error('superseded'))
      _pendingDiscord = null
    }

    let port
    try {
      port = await startOAuthServer()
      console.log('[discord:auth] OAuth server listening on port', port)
    } catch (e) {
      reject(new Error('Failed to start OAuth callback server'))
      return
    }

    const params = new URLSearchParams({ action, source: 'desktop', port: String(port) })
    if (inviteCode) params.set('inviteCode', inviteCode)

    const authUrl = `${API_BASE}/api/auth/discord?${params}`

    // 5-minute timeout — user closed the browser without finishing
    const timer = setTimeout(() => {
      if (_pendingDiscord) {
        _pendingDiscord = null
        if (_oauthServer) { _oauthServer.close(); _oauthServer = null }
        reject(new Error('timeout'))
      }
    }, 5 * 60 * 1000)

    _pendingDiscord = { resolve, reject, timer }
    shell.openExternal(authUrl)
  })
})
