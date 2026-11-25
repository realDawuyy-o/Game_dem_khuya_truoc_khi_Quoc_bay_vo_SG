package main

import (
	"context"
	"math/rand/v2"
	"strings"
	"sync"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

// No I or O, they're easy to confuse with 1 and 0 when reading a code out loud.
const codeLetters = "ABCDEFGHJKLMNPQRSTUVWXYZ"

type Hub struct {
	mu     sync.Mutex
	rooms  map[string]*Room
	sounds []Sound
	audio  *AudioStore
}

func newHub(sounds []Sound, audio *AudioStore) *Hub {
	return &Hub{rooms: make(map[string]*Room), sounds: sounds, audio: audio}
}

// serve handles one connection: the first message must be create or join,
// then the player stays in that room until they disconnect.
func (h *Hub) serve(ctx context.Context, conn *websocket.Conn) {
	defer conn.CloseNow()

	var msg inMsg
	if err := wsjson.Read(ctx, conn, &msg); err != nil {
		return
	}

	name := strings.TrimSpace(msg.Name)
	if name == "" || len([]rune(name)) > 16 {
		wsjson.Write(ctx, conn, errorMsg("name must be 1-16 characters"))
		return
	}

	var room *Room
	switch msg.Type {
	case "create":
		room = h.create(msg.Solo)
	case "join":
		room = h.find(strings.ToUpper(strings.TrimSpace(msg.Room)))
		if room == nil {
			wsjson.Write(ctx, conn, errorMsg("room not found"))
			return
		}
	default:
		wsjson.Write(ctx, conn, errorMsg("first message must be create or join"))
		return
	}

	p := newPlayer(name, conn)
	if err := room.join(p); err != nil {
		wsjson.Write(ctx, conn, errorMsg(err.Error()))
		return
	}
	defer room.leave(p)

	go p.writeLoop(ctx)
	p.readLoop(ctx, room)
}

func (h *Hub) create(solo bool) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()

	code := h.newCode()
	room := newRoom(code, h.sounds, h.audio, solo, func() { h.remove(code) })
	h.rooms[code] = room
	go room.run()
	return room
}

// newCode must be called with h.mu held.
func (h *Hub) newCode() string {
	for {
		b := make([]byte, 4)
		for i := range b {
			b[i] = codeLetters[rand.IntN(len(codeLetters))]
		}
		if _, taken := h.rooms[string(b)]; !taken {
			return string(b)
		}
	}
}

func (h *Hub) find(code string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.rooms[code]
}

func (h *Hub) remove(code string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.rooms, code)
}
