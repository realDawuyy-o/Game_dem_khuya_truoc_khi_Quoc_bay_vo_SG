package main

import (
	"fmt"
	"testing"
	"time"
)

func TestSoloRoomCanStartWithOnePlayer(t *testing.T) {
	audio := newAudioStore()
	room := newRoom("TEST", []Sound{{Name: "cat", Samples: []int16{1, 2, 3}}}, audio, true, func() {})
	go room.run()

	player := newPlayer("Tester", nil)
	if err := room.join(player); err != nil {
		t.Fatalf("join solo room: %v", err)
	}
	t.Cleanup(func() {
		room.leave(player)
		select {
		case <-room.done:
		case <-time.After(time.Second):
			t.Error("room did not close after its last player left")
		}
	})
	<-player.send

	room.handle(player, inMsg{Type: "start"})
	select {
	case message := <-player.send:
		if round, ok := message.(roundStartOut); !ok || round.Round != 1 {
			t.Fatalf("start message = %#v, want round_start for round 1", message)
		}
	case <-time.After(time.Second):
		t.Fatal("solo room did not start a round")
	}
}

func TestRegularRoomStillRequiresTwoPlayers(t *testing.T) {
	room := newRoom("TEST", []Sound{{Name: "cat", Samples: []int16{1, 2, 3}}}, newAudioStore(), false, func() {})
	go room.run()

	player := newPlayer("Tester", nil)
	if err := room.join(player); err != nil {
		t.Fatalf("join room: %v", err)
	}

	t.Cleanup(func() {
		room.leave(player)
		select {
		case <-room.done:
		case <-time.After(time.Second):
			t.Error("room did not close after its last player left")
		}
	})
	<-player.send

	room.handle(player, inMsg{Type: "start"})
	select {
	case message := <-player.send:
		if serverError, ok := message.(errorOut); !ok || serverError.Message != "need at least 2 players" {
			t.Fatalf("start response = %#v, want two-player minimum error", message)
		}
	case <-time.After(time.Second):
		t.Fatal("room did not respond to start request")
	}
}

func TestRoomStateIncludesPlayerCharacter(t *testing.T) {
	room := newRoom("TEST", []Sound{{Name: "cat", Samples: []int16{1, 2, 3}}}, newAudioStore(), true, func() {})
	go room.run()

	player := newPlayer("Tester", nil)
	player.character = "kiwi"
	if err := room.join(player); err != nil {
		t.Fatalf("join room: %v", err)
	}
	t.Cleanup(func() {
		room.leave(player)
		select {
		case <-room.done:
		case <-time.After(time.Second):
			t.Error("room did not close after its last player left")
		}
	})

	message := <-player.send
	state, ok := message.(stateOut)
	if !ok || len(state.Players) != 1 || state.Players[0].Character != "kiwi" ||
		state.Mode != defaultGameModeID || state.MaxPlayers != 32 {
		t.Fatalf("room state = %#v, want player character kiwi", message)
	}
}

func TestRoomSupportsModePlayerCapacity(t *testing.T) {
	room := newRoom("TEST", []Sound{{Name: "cat", Samples: []int16{1, 2, 3}}}, newAudioStore(), false, func() {})
	go room.run()
	t.Cleanup(func() {
		room.do(func() { room.close() })
		select {
		case <-room.done:
		case <-time.After(time.Second):
			t.Error("room did not close during cleanup")
		}
	})

	players := make([]*Player, 0, 32)
	for index := range 32 {
		player := newPlayer(fmt.Sprintf("Player%02d", index), nil)
		if err := room.join(player); err != nil {
			t.Fatalf("join player %d: %v", index+1, err)
		}
		players = append(players, player)
		for _, joined := range players {
			for len(joined.send) > 0 {
				<-joined.send
			}
		}
	}

	if err := room.join(newPlayer("Player33", nil)); err == nil || err.Error() != "room is full" {
		t.Fatalf("join 33rd player error = %v, want room is full", err)
	}
}
