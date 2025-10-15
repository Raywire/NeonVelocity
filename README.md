## Neon Velocity - Run Locally

Serve the game over HTTP to avoid browser CORS/file:// restrictions.

### Option A: Node http-server (recommended)

1) Open a terminal and navigate to the game folder

```bash
cd "NeonVelocity"
```

2) Run a local server on port 5173

```bash
npx http-server -p 5173 -c-1
```

3) Open the game in your browser

```text
http://127.0.0.1:5173/
```

Notes:
- If prompted to install, select “Yes” to use the latest `http-server`.
- `-c-1` disables caching during development.

### Option B: Python built-in server (fallback)

```bash
cd "NeonVelocity"
python -m http.server 5173
```

Then open `http://127.0.0.1:5173/`.

### Controls
- Keyboard: Left/Right or A/D to steer, Space to quick turbo, Enter to start
- Touch: Drag to steer, two-finger tap to turbo

### Troubleshooting
- Opening `index.html` directly via `file://` will fail due to CORS; use one of the servers above.
- If the port is busy, change `5173` to an open port in both the command and the URL.

