'use strict';

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// ─── Helpers ────────────────────────────────────────────────────────────────

const EXT_MIME = {
  // images
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif',
  '.webp':'image/webp','.svg':'image/svg+xml','.bmp':'image/bmp','.ico':'image/x-icon',
  '.tiff':'image/tiff','.avif':'image/avif','.heic':'image/heic',
  // video
  '.mp4':'video/mp4','.mkv':'video/x-matroska','.avi':'video/x-msvideo',
  '.mov':'video/quicktime','.wmv':'video/x-ms-wmv','.flv':'video/x-flv',
  '.webm':'video/webm','.m4v':'video/x-m4v',
  // audio
  '.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.flac':'audio/flac',
  '.aac':'audio/aac','.m4a':'audio/x-m4a','.wma':'audio/x-ms-wma','.opus':'audio/opus',
  // documents
  '.pdf':'application/pdf','.doc':'application/msword',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':'application/vnd.ms-excel',
  '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt':'application/vnd.ms-powerpoint',
  '.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt':'application/vnd.oasis.opendocument.text',
  '.ods':'application/vnd.oasis.opendocument.spreadsheet',
  // archives
  '.zip':'application/zip','.tar':'application/x-tar','.gz':'application/gzip',
  '.bz2':'application/x-bzip2','.xz':'application/x-xz','.7z':'application/x-7z-compressed',
  '.rar':'application/vnd.rar','.zst':'application/zstd','.deb':'application/x-deb',
  '.rpm':'application/x-rpm',
  // text / code
  '.txt':'text/plain','.md':'text/markdown','.rst':'text/x-rst','.csv':'text/csv',
  '.html':'text/html','.htm':'text/html','.css':'text/css',
  '.js':'text/javascript','.mjs':'text/javascript','.cjs':'text/javascript',
  '.ts':'text/typescript','.tsx':'text/typescript','.jsx':'text/javascript',
  '.json':'application/json','.yaml':'text/yaml','.yml':'text/yaml',
  '.toml':'text/toml','.ini':'text/x-ini','.cfg':'text/x-ini','.conf':'text/plain',
  '.xml':'application/xml','.svg':'image/svg+xml',
  '.py':'text/x-python','.rb':'text/x-ruby','.php':'text/x-php',
  '.sh':'application/x-sh','.bash':'application/x-sh','.zsh':'application/x-sh',
  '.fish':'application/x-sh','.bat':'application/x-msdos-program',
  '.ps1':'application/x-powershell',
  '.c':'text/x-csrc','.h':'text/x-chdr','.cpp':'text/x-c++src',
  '.hpp':'text/x-c++hdr','.cc':'text/x-c++src',
  '.java':'text/x-java','.kt':'text/x-kotlin','.kts':'text/x-kotlin',
  '.go':'text/x-go','.rs':'text/x-rustsrc','.dart':'text/x-dart',
  '.lua':'text/x-lua','.r':'text/x-r','.swift':'text/x-swift',
  '.vb':'text/x-vb','.cs':'text/x-csharp','.fs':'text/x-fsharp',
  '.hs':'text/x-haskell','.ml':'text/x-ocaml','.elm':'text/x-elm',
  '.vue':'text/x-vue','.svelte':'text/x-svelte',
  '.sql':'application/sql','.db':'application/x-sqlite3','.sqlite':'application/x-sqlite3',
  // executables / system
  '.bin':'application/octet-stream','.exe':'application/x-msdownload',
  '.dll':'application/x-msdownload','.so':'application/x-sharedlib',
  '.AppImage':'application/x-executable','.run':'application/x-executable',
  // fonts
  '.ttf':'font/ttf','.otf':'font/otf','.woff':'font/woff','.woff2':'font/woff2',
  // misc
  '.iso':'application/x-iso9660-image','.img':'application/octet-stream',
  '.log':'text/plain','.lock':'text/plain','.env':'text/plain',
  '.gitignore':'text/plain','.dockerfile':'text/plain',
};

function getMime(filename) {
  const ext = path.extname(filename).toLowerCase();
  return EXT_MIME[ext] || 'application/octet-stream';
}

function humanSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KiB','MiB','GiB','TiB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1) + ' ' + sizes[i];
}

function statSafe(p) {
  try { return fs.statSync(p); } catch { return null; }
}

function lstatSafe(p) {
  try { return fs.lstatSync(p); } catch { return null; }
}

function entryInfo(dirPath, entry) {
  const fullPath = path.join(dirPath, entry.name);
  const lstat = lstatSafe(fullPath);
  const stat  = entry.isSymbolicLink() ? statSafe(fullPath) : lstat;
  const size  = stat ? stat.size : 0;
  const mtime = stat ? stat.mtime : new Date(0);
  const mode  = lstat ? lstat.mode.toString(8).slice(-4) : '----';
  return {
    name:      entry.name,
    path:      fullPath,
    isDir:     entry.isDirectory() || (entry.isSymbolicLink() && stat && stat.isDirectory()),
    isSymlink: entry.isSymbolicLink(),
    size,
    sizeHuman: humanSize(size),
    modified:  mtime.toISOString(),
    mimeType:  entry.isDirectory() ? 'inode/directory' : getMime(entry.name),
    mode,
  };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

const START_DIR = process.env.START_DIR || process.cwd();

// launchId lets runme confirm it reached this server, not another one on the port
app.get('/api/ping', (_req, res) => res.json({ ok: true, launchId: process.env.DLW_LAUNCH_ID || null }));

app.get('/api/home', (_req, res) => {
  res.json({ home: START_DIR, user: os.userInfo().username });
});

app.get('/api/ls', (req, res) => {
  const dirPath    = req.query.path || os.homedir();
  const showHidden = req.query.showHidden === 'true';
  const sortBy     = req.query.sort || 'name';    // name|size|type|modified
  const sortDir    = req.query.dir  || 'asc';

  try {
    const raw = fs.readdirSync(dirPath, { withFileTypes: true });
    let entries = raw
      .filter(e => showHidden || !e.name.startsWith('.'))
      .map(e => { try { return entryInfo(dirPath, e); } catch { return null; } })
      .filter(Boolean);

    // Sort
    entries.sort((a, b) => {
      // Dirs always first
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let cmp = 0;
      switch (sortBy) {
        case 'size':     cmp = a.size - b.size; break;
        case 'type':     cmp = a.mimeType.localeCompare(b.mimeType); break;
        case 'modified': cmp = new Date(a.modified) - new Date(b.modified); break;
        default:         cmp = a.name.localeCompare(b.name, undefined, {numeric:true,sensitivity:'base'}); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    const totalSize = entries.reduce((s, e) => s + e.size, 0);
    const dirCount  = entries.filter(e => e.isDir).length;
    const fileCount = entries.length - dirCount;

    res.json({ path: dirPath, entries, totalSize, dirCount, fileCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/places', (_req, res) => {
  const home = os.homedir();
  const raw = [
    { label: 'Places', type: 'header' },
    { name: 'Home',      path: home,                             icon: 'home'      },
    { name: 'Desktop',   path: path.join(home, 'Desktop'),       icon: 'desktop'   },
    { name: 'Documents', path: path.join(home, 'Documents'),     icon: 'documents' },
    { name: 'Downloads', path: path.join(home, 'Downloads'),     icon: 'downloads' },
    { name: 'Music',     path: path.join(home, 'Music'),         icon: 'audio'     },
    { name: 'Pictures',  path: path.join(home, 'Pictures'),      icon: 'images'    },
    { name: 'Videos',    path: path.join(home, 'Videos'),        icon: 'video'     },
    { label: 'System', type: 'header' },
    { name: 'Root',      path: '/',                              icon: 'root'      },
    { name: 'tmp',       path: '/tmp',                           icon: 'folder'    },
    { name: 'Trash',     path: path.join(home,'.local/share/Trash/files'), icon: 'trash' },
  ];

  // Detect mount points on Linux
  const mounts = [];
  try {
    const mntEntries = fs.readdirSync('/media', { withFileTypes: true });
    for (const e of mntEntries) {
      if (e.isDirectory()) {
        const sub = fs.readdirSync(path.join('/media', e.name), { withFileTypes: true });
        for (const s of sub) {
          mounts.push({ name: s.name, path: path.join('/media', e.name, s.name), icon: 'drive' });
        }
      }
    }
  } catch {}
  try {
    const run = fs.readdirSync('/run/media', { withFileTypes: true });
    for (const e of run) {
      if (e.isDirectory()) {
        const sub = fs.readdirSync(path.join('/run/media', e.name), { withFileTypes: true });
        for (const s of sub) {
          mounts.push({ name: s.name, path: path.join('/run/media', e.name, s.name), icon: 'drive' });
        }
      }
    }
  } catch {}

  const places = [...raw];
  if (mounts.length) {
    places.push({ label: 'Devices', type: 'header' });
    places.push(...mounts);
  }

  res.json({ places });
});

app.get('/api/stat', (req, res) => {
  const p = req.query.path;
  if (!p) return res.status(400).json({ error: 'path required' });
  try {
    const lstat = fs.lstatSync(p);
    const stat  = lstat.isSymbolicLink() ? fs.statSync(p) : lstat;
    let target = null;
    if (lstat.isSymbolicLink()) { try { target = fs.readlinkSync(p); } catch {} }
    res.json({
      path: p,
      name: path.basename(p),
      isDir: stat.isDirectory(),
      isSymlink: lstat.isSymbolicLink(),
      symlinkTarget: target,
      size: stat.size,
      sizeHuman: humanSize(stat.size),
      modified: stat.mtime.toISOString(),
      created:  stat.birthtime.toISOString(),
      accessed: stat.atime.toISOString(),
      mode: lstat.mode.toString(8).slice(-4),
      mimeType: stat.isDirectory() ? 'inode/directory' : getMime(path.basename(p)),
      uid: stat.uid,
      gid: stat.gid,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/mkdir', (req, res) => {
  const { path: p } = req.body;
  try { fs.mkdirSync(p, { recursive: false }); res.json({ success: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/rename', (req, res) => {
  const { oldPath, newPath } = req.body;
  try { fs.renameSync(oldPath, newPath); res.json({ success: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/delete', (req, res) => {
  const { paths } = req.body;
  try {
    for (const p of (paths || [])) fs.rmSync(p, { recursive: true, force: true });
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/copy', (req, res) => {
  const { src, dest } = req.body;
  try {
    const s = fs.statSync(src);
    if (s.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.copyFileSync(src, dest);
    }
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Glob → RegExp converter ──────────────────────────────────────────────────
function globToRegex(pattern, caseSensitive) {
  const flags = caseSensitive ? '' : 'i';
  const hasWildcard = /[*?\[]/.test(pattern);

  if (!hasWildcard) {
    // No wildcards: substring match (same feel as before)
    const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(esc, flags);
  }

  // Wildcards present: convert to anchored whole-name regex
  let re = '^';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if      (ch === '*') { re += '.*'; }
    else if (ch === '?') { re += '.';  }
    else if (ch === '[') {
      let cls = '[';
      i++;
      if (i < pattern.length && (pattern[i] === '!' || pattern[i] === '^')) {
        cls += '^'; i++;
      }
      while (i < pattern.length && pattern[i] !== ']') {
        const c = pattern[i];
        cls += (c === '\\') ? '\\\\' : c;
        i++;
      }
      cls += ']';
      re  += cls;
    } else {
      re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  re += '$';

  try   { return new RegExp(re, flags); }
  catch { return null; }
}


app.get('/api/search', (req, res) => {
  const { path: searchPath, query, regex, caseSensitive, showHidden } = req.query;
  if (!query) return res.json({ results: [] });

  const useRegex    = regex       === 'true';
  const caseSens    = caseSensitive === 'true';
  const inclHidden  = showHidden  !== 'false';   // default true during search
  const results     = [];
  const MAX         = 300;

  let matcher;
  if (useRegex) {
    try {
      const re = new RegExp(query, caseSens ? '' : 'i');
      matcher  = name => re.test(name);
    } catch (e) {
      return res.status(400).json({ error: `Invalid regex: ${e.message}` });
    }
  } else {
    const re = globToRegex(query, caseSens);
    if (!re) return res.status(400).json({ error: 'Invalid glob pattern' });
    matcher = name => re.test(name);
  }

  function walk(dir, depth) {
    if (results.length >= MAX || depth > 6) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (results.length >= MAX) break;
      if (!inclHidden && e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (matcher(e.name)) {
        const st = statSafe(full);
        results.push({
          name: e.name, path: full,
          isDir: e.isDirectory(),
          size: st ? st.size : 0,
          sizeHuman: humanSize(st ? st.size : 0),
          modified: st ? st.mtime.toISOString() : new Date(0).toISOString(),
          mimeType: e.isDirectory() ? 'inode/directory' : getMime(e.name),
        });
      }
      if (e.isDirectory()) continue; // depth-1 only — don't recurse
    }
  }

  walk(searchPath || os.homedir(), 0);
  res.json({ results, truncated: results.length >= MAX });
});

// ─── Directory watch (SSE) ────────────────────────────────────────────────────

app.get('/api/watch', (req, res) => {
  const dir = req.query.path;
  if (!dir) return res.status(400).end();

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // Keep connection alive with a periodic comment
  const heartbeat = setInterval(() => res.write(':\n\n'), 15000);

  let watcher;
  try {
    watcher = fs.watch(dir, { persistent: false }, (eventType, filename) => {
      if (filename === SETTINGS_FILE) return;   // ignore our own settings writes
      res.write(`data: ${JSON.stringify({ event: eventType, filename })}\n\n`);
    });
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    clearInterval(heartbeat);
    return res.end();
  }

  req.on('close', () => {
    clearInterval(heartbeat);
    try { watcher.close(); } catch {}
  });
});


app.post('/api/shutdown', (_req, res) => {
  res.json({ bye: true });
  // Brief delay lets the settings beacon finish processing before we exit
  setTimeout(() => {
    console.log('\n  🐬 Browser closed — shutting down.\n');
    // Kill nodemon (our parent process) so it doesn't restart us
    try { process.kill(process.ppid, 'SIGTERM'); } catch {}
    process.exit(0);
  }, 400);
});



const SETTINGS_FILE = '.dolphin-lite-web.json';

app.get('/api/settings', (req, res) => {
  const dir = req.query.path;
  if (!dir) return res.status(400).json({ error: 'path required' });
  const file = path.join(dir, SETTINGS_FILE);
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json({ settings: data, exists: true });
  } catch {
    res.json({ settings: null, exists: false });
  }
});

app.post('/api/settings', (req, res) => {
  const { path: dir, settings } = req.body;
  if (!dir) return res.status(400).json({ error: 'path required' });
  const file = path.join(dir, SETTINGS_FILE);
  try {
    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    const merged = { ...existing, ...settings };
    fs.writeFileSync(file, JSON.stringify(merged, null, 2), 'utf8');
    console.log(`  💾 Settings saved → ${dir}/${SETTINGS_FILE}`);
    res.json({ success: true });
  } catch (e) {
    console.error(`  ❌ Settings write failed: ${file} — ${e.message}`);
    res.status(400).json({ error: e.message });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  🐬 Dolphin Lite Web`);
  console.log(`  ──────────────────────────`);
  console.log(`  Open: http://localhost:${PORT}\n`);
});
