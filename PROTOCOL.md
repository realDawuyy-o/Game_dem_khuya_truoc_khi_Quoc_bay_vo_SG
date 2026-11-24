# Protocol

Everything goes over one WebSocket. All messages are JSON with a `type` field.

- WebSocket: `ws://<backend>/ws` (`wss://` in production)
- Audio: `http://<backend>/audio/{id}` — the server sends the path, you prepend the backend host
- Local dev backend: `localhost:8080`

## Game flow

```
connect → create / join → lobby ──host sends start──► round ──► reveal ──► round ... (10 rounds)
                            ▲                                                   │
                            └──────────────── game_over ◄───────────────────────┘
```

- **lobby**: waiting for players. Host can start with 2–8 players.
- **round**: mixed audio plays, players pick which sounds they hear. 20s, or ends early once everyone has guessed.
- **reveal**: answer and points shown for 5s, then the next round starts automatically.
- After round 10 the server sends `game_over` and the room goes back to **lobby**. Host can start again (scores reset).

## Client → server

### `create` (first message only)
```json
{ "type": "create", "name": "Quoc" }
```
Creates a room and makes you the host. You'll get a `room_state` with the room `code`.

### `join` (first message only)
```json
{ "type": "join", "room": "ABCD", "name": "Minh" }
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

## Server → client

### `room_state`
Sent whenever anything changes (join, leave, guess, phase change). Just re-render from it.
```json
{
  "type": "room_state",
  "code": "ABCD",
  "phase": "lobby",            // lobby | round | reveal
  "host": "Quoc",
  "round": 0,
  "totalRounds": 10,
  "players": [
    { "name": "Quoc", "score": 0, "connected": true, "guessed": false },
    { "name": "Minh", "score": 0, "connected": true, "guessed": false }
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
    { "name": "Quoc", "picks": ["cat", "dog"], "points": 140 },
    { "name": "Minh", "picks": null, "points": 0 }
  ]
}
```
`picks` is `null` if the player didn't guess.

### `game_over`
```json
{
  "type": "game_over",
  "leaderboard": [
    { "name": "Quoc", "score": 2310 },
    { "name": "Minh", "score": 1980 }
  ]
}
```
Sorted highest first. Followed by a `room_state` with `phase: "lobby"`.

### `error`
```json
{ "type": "error", "message": "room not found" }
```
If it's a reply to `create`/`join`, the server closes the connection after sending it. Otherwise the connection stays open.

Messages you might see: `name must be 1-16 characters`, `room not found`, `name already taken`, `game already started`, `room is full`, `room closed`, `only the host can start`, `need at least 2 players`, `not accepting guesses right now`, `already guessed this round`, `pick 1 to N sounds`, `not a choice: X`.

## Scoring

Per correct pick: **100 + speed bonus** (up to 50, shrinks to 0 as the timer runs out). Wrong picks and no guess are worth 0.

## Minimal client

```js
const BACKEND = "localhost:8080";
const ws = new WebSocket(`ws://${BACKEND}/ws`);

ws.onopen = () => ws.send(JSON.stringify({ type: "join", room: "ABCD", name: "Minh" }));

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  switch (msg.type) {
    case "room_state": /* render lobby / scoreboard */ break;
    case "round_start":
      new Audio(`http://${BACKEND}${msg.audioUrl}`).play();
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

Browsers block audio until the user has interacted with the page, so the join/create button click is enough to unlock it.
