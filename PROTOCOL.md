# Protocol

Everything goes over one WebSocket. All messages are JSON with a `type` field.

- WebSocket: `ws://<backend>/ws` (`wss://` in production)
- Audio: `http://<backend>/audio/{id}` — the server sends the path, you prepend the backend host
- Local dev backend: `localhost:8080`
- The bundled client uses the same origin in production and `localhost:8080` when the web page is served locally.
- To use a separate backend, set the `game-backend` meta tag in `web/index.html` to its host or full `https://` URL. The client automatically uses `wss://` for HTTPS.

## Game flow

```
connect → create / join → lobby ──host sends start──► round ──► reveal ──► round ... (10 rounds)
                            ▲                                                   │
                            └──────────────── game_over ◄───────────────────────┘
```

- **lobby**: waiting for players. Sound Mix rooms support 2–32 players. A solo test room can start with one.
- **round**: mixed audio plays, players pick which sounds they hear. 20s, or ends early once everyone has guessed.
- **reveal**: answer and points shown for 5s, then the next round starts automatically.
- After round 10 the server sends `game_over` and the room goes back to **lobby**. Host can start again (scores reset).

## Adding a game mode

Use the entries in `server/game_modes.go` as the shared mode template: each mode declares its ID, player bounds, round count, and solo/availability flags. Add a matching picker card in `web/index.html` and display name in `web/client.js`. Future modes reuse the room's multiplayer membership, host checks, phase/state broadcasts, reconnect behavior, and round lifecycle; implement their own round-start, input, reveal, and scoring rules before marking them available. Keep unfinished modes disabled in the picker so players cannot create rooms that have no gameplay handlers.

## Client → server

### `create` (first message only)
```json
{ "type": "create", "name": "Quoc", "character": "krill", "mode": "sound_mix" }
```
Creates a room and makes you the host. You'll get a `room_state` with the room `code`.
`character` is the selected character ID: `krill`, `remix`, `trumpet`, `bamboo`, `maestro`, `boomer`, `howler`, `panpipe`, `kalimba`, or `kiwi`. It defaults to `krill` when omitted.
`mode` defaults to `sound_mix` when omitted. `beat_builder` and `animal_groove` are reserved mode templates and cannot be hosted until their round handlers are implemented.
For a one-player local test, pass `"solo": true`; the room then accepts a start with its single player.

```json
{ "type": "create", "name": "Quoc", "character": "krill", "mode": "sound_mix", "solo": true }
```

### `join` (first message only)
```json
{ "type": "join", "room": "ABCD", "name": "Minh", "character": "remix" }
```
- Name: 1–16 characters, unique in the room.
- Room code is case-insensitive.
- Only possible while the room is in the lobby — **except** reconnecting: if you dropped mid-game, join again with the same name and you get your score back plus the current `round_start`.

### `start` (host only, in lobby)
```json
{ "type": "start" }
```

### `guess` (once per round)
```json
{ "type": "guess", "picks": ["cat", "dog"] }
```
- 1 to `count` picks, each must be from `choices`.
- One guess per round, can't change it after sending.

### `rename` (any time)
```json
{ "type": "rename", "name": "New name" }
```
Changes your name in the room. Names remain unique and limited to 1–16 characters.

## Server → client

### `room_state`
Sent whenever anything changes (join, leave, guess, phase change). Just re-render from it.
```json
{
  "type": "room_state",
  "code": "ABCD",
  "mode": "sound_mix",
  "minPlayers": 2,
  "maxPlayers": 32,
  "phase": "lobby",            // lobby | round | reveal
  "host": "Quoc",
  "round": 0,
  "totalRounds": 10,
  "players": [
    { "name": "Quoc", "character": "krill", "score": 0, "connected": true, "guessed": false },
    { "name": "Minh", "character": "remix", "score": 0, "connected": true, "guessed": false }
  ]
}
```
- `guessed` only says *whether* someone answered, never what they picked.
- `connected: false` = dropped mid-game, can still reconnect.

### `round_start`
```json
{
  "type": "round_start",
  "round": 1,
  "totalRounds": 10,
  "audioUrl": "/audio/SI42C33NDNHEJ3446HZT3EQPAD",
  "choices": ["cat", "dog", "cow", "duck", "lion", "frog", "owl", "goat"],
  "count": 2,
  "endsAt": 1795538514792
}
```
- `audioUrl`: one WAV with `count` sounds mixed together. It's deleted when the round ends, so load it right away.
- `count`: how many sounds are in the mix (2 in rounds 1–3, 3 in rounds 4–7, 4 in rounds 8–10).
- `endsAt`: unix ms. Show a countdown with `endsAt - Date.now()`; the server ends the round on its own timer.

### `round_end`
```json
{
  "type": "round_end",
  "answer": ["cat", "owl"],
  "results": [
    { "name": "Quoc", "character": "krill", "picks": ["cat", "dog"], "points": 140 },
    { "name": "Minh", "character": "remix", "picks": null, "points": 0 }
  ]
}
```
`picks` is `null` if the player didn't guess.

### `game_over`
```json
{
  "type": "game_over",
  "leaderboard": [
    { "name": "Quoc", "character": "krill", "score": 2310 },
    { "name": "Minh", "character": "remix", "score": 1980 }
  ]
}
```
Sorted highest first. Followed by a `room_state` with `phase: "lobby"`.

### `error`
```json
{ "type": "error", "message": "room not found" }
```
If it's a reply to `create`/`join`, the server closes the connection after sending it. Otherwise the connection stays open.

Messages you might see: `name must be 1-16 characters`, `unknown character`, `unknown game mode`, `game mode is not available yet`, `solo play is not available for this game mode`, `room not found`, `name already taken`, `game already started`, `room is full`, `room closed`, `only the host can start`, `need at least 2 players`, `not accepting guesses right now`, `already guessed this round`, `pick 1 to N sounds`, `not a choice: X`.

## Scoring

Per correct pick: **100 + speed bonus** (up to 50, shrinks to 0 as the timer runs out). Wrong picks and no guess are worth 0.

## Minimal client

```js
const BACKEND = "http://localhost:8080";
const socketURL = new URL("/ws", BACKEND);
socketURL.protocol = socketURL.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(socketURL);

ws.onopen = () => ws.send(JSON.stringify({ type: "join", room: "ABCD", name: "Minh" }));

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  switch (msg.type) {
    case "room_state": /* render lobby / scoreboard */ break;
    case "round_start":
      new Audio(new URL(msg.audioUrl, BACKEND)).play();
      /* show msg.choices, let the player pick msg.count of them */
      break;
    case "round_end": /* show msg.answer and msg.results */ break;
    case "game_over": /* show msg.leaderboard */ break;
    case "error": alert(msg.message); break;
  }
};

// on submit:
ws.send(JSON.stringify({ type: "guess", picks: ["cat", "dog"] }));
```

## Azure/container deployment

The root `Dockerfile` serves the web app, WebSocket API, health endpoint, and round audio from one container. It reads `PORT`, `SOUNDS_DIR`, and `WEB_DIR`; the defaults in the image are ready for Azure App Service for Containers. Keep the container port at `8080`, enable WebSockets in the App Service, and configure `ALLOWED_ORIGINS` to the exact browser origin only when the UI is hosted separately. The GitHub Actions workflow runs tests, checks the client syntax, and builds the image on pushes and pull requests. Publishing the image and deploying it to Azure can be added later with the target Azure resource and GitHub secrets.

Browsers block audio until the user has interacted with the page, so the join/create button click is enough to unlock it.
