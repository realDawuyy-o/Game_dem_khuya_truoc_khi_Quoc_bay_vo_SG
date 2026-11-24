package main

import (
	"context"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

type Player struct {
	name string
	conn *websocket.Conn
	send chan any
}

func newPlayer(name string, conn *websocket.Conn) *Player {
	return &Player{name: name, conn: conn, send: make(chan any, 16)}
}

// deliver never blocks, so one laggy player can't stall the whole room.
func (p *Player) deliver(msg any) {
	select {
	case p.send <- msg:
	default:
		p.conn.CloseNow() // buffer full: the client is too slow, drop it
	}
}

func (p *Player) writeLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-p.send:
			wctx, cancel := context.WithTimeout(ctx, 5*time.Second)
			err := wsjson.Write(wctx, p.conn, msg)
			cancel()
			if err != nil {
				p.conn.CloseNow()
				return
			}
		}
	}
}

func (p *Player) readLoop(ctx context.Context, room *Room) {
	for {
		var msg inMsg
		if err := wsjson.Read(ctx, p.conn, &msg); err != nil {
			return
		}
		room.handle(p, msg)
	}
}
