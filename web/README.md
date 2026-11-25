# Badabum

A music-themed lobby for Badabum, with a cast of animals from around the world.

## Run locally

Start the game server from the `server` directory:

```powershell
go run .
```

Open [http://localhost:8080](http://localhost:8080) in a browser. The server
serves the UI, multiplayer API, and round audio on the same origin. It loads
16-bit and 24-bit PCM `.wav` game sounds (mono or stereo, at supported sample
rates) from the repository's `sound_library` directory, converting them to the
game's mono 22.05 kHz mix format when the server starts.

Click “ARE YOU READY?” to open the lobby. Host a room, join with its four-letter
code, or choose “SOLO TEST” to run the real server rounds alone. The solo room
uses the same round timing, audio, answers, and scoring as multiplayer.

The client uses `localhost:8080` automatically when served on localhost. To
point a separately hosted frontend at the API, set the `game-backend` meta tag
in `index.html` to the backend host (for example `my-game.azurewebsites.net`)
or its full `https://` URL. The WebSocket automatically uses `wss://` over
HTTPS.

The root `Dockerfile` packages the frontend and server together. The GitHub
Actions workflow tests the server and builds the container; Azure publishing
and deployment can be added after choosing the Azure resource and credentials.