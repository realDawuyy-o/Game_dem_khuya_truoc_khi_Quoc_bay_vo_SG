# Badabum

A music-themed lobby for Badabum, with a cast of animals from around the world.

## Preview locally

From this directory, start a static server:

```powershell
py -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) in a browser. If `py` is
unavailable, use `python -m http.server 8000`. Stop the server with Ctrl+C.

The animated `background.gif` and page styles load automatically. Click
“ARE YOU READY?” to open the lobby and start `intro.mp3`; this user gesture
allows playback in browsers that block autoplay. Character previews use Web
Audio, and the sound preference is stored locally. Live multiplayer requires
a game-server connection.