package main

import (
	"cmp"
	"errors"
	"fmt"
	"math/rand/v2"
	"slices"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	numChoices = 8
	roundTime  = 20 * time.Second
	revealTime = 5 * time.Second

	pointsCorrect = 100
	maxSpeedBonus = 50 // per correct pick, shrinks linearly to 0 as the timer runs out
)

const (
	phaseLobby  = "lobby"
	phaseRound  = "round"
	phaseReveal = "reveal"
)

var errRoomClosed = errors.New("room closed")

type member struct {
	player    *Player // nil while disconnected mid-game
	name      string
	character string
	score     int
	picks     []string
	guessed   bool
	guessedAt time.Time
}

// Room runs as a single goroutine: every change goes through r.events,
// so the fields below never need a lock.
type Room struct {
	code    string
	sounds  []Sound
	audio   *AudioStore
	mode    gameModeSpec
	solo    bool
	onEmpty func()
	events  chan func()
	done    chan struct{}

	members    []*member
	host       string
	phase      string
	phaseID    int // bumped on every phase change so stale timers do nothing
	round      int
	choices    []string
	answer     []string
	audioID    string
	roundStart time.Time
	current    roundStartOut // resent to players who reconnect mid-round
	closed     bool
}

func newRoom(code string, sounds []Sound, audio *AudioStore, solo bool, onEmpty func()) *Room {
	mode, _ := findGameMode(defaultGameModeID)
	return newRoomWithMode(code, sounds, audio, solo, mode, onEmpty)
}

func newRoomWithMode(code string, sounds []Sound, audio *AudioStore, solo bool, mode gameModeSpec, onEmpty func()) *Room {
	return &Room{
		code:    code,
		sounds:  sounds,
		audio:   audio,
		mode:    mode,
		solo:    solo,
		onEmpty: onEmpty,
		events:  make(chan func()),
		done:    make(chan struct{}),
		phase:   phaseLobby,
	}
}

func (r *Room) run() {
	defer close(r.done)
	for {
		f := <-r.events
		f()
		if r.closed {
			return
		}
	}
}

// do runs f on the room's goroutine. Returns false if the room is already closed.
func (r *Room) do(f func()) bool {
	select {
	case r.events <- f:
		return true
	case <-r.done:
		return false
	}
}

// after runs f once d has passed, unless the phase changed in the meantime.
func (r *Room) after(d time.Duration, f func()) {
	id := r.phaseID
	time.AfterFunc(d, func() {
		r.do(func() {
			if r.phaseID == id {
				f()
			}
		})
	})
}

func (r *Room) join(p *Player) error {
	errc := make(chan error, 1)
	if !r.do(func() { errc <- r.addPlayer(p) }) {
		return errRoomClosed
	}
	return <-errc
}

func (r *Room) leave(p *Player) {
	r.do(func() { r.removePlayer(p) })
}

func (r *Room) handle(p *Player, msg inMsg) {
	r.do(func() {
		switch msg.Type {
		case "start":
			r.onStart(p)
		case "guess":
			r.onGuess(p, msg.Picks)
		case "rename":
			r.onRename(p, msg.Name)
		default:
			p.deliver(errorMsg("unknown message type: " + msg.Type))
		}
	})
}

func (r *Room) onRename(p *Player, name string) {
	m := r.byPlayer(p)
	name = strings.TrimSpace(name)
	if m == nil {
		p.deliver(errorMsg("not a member of this room"))
		return
	}
	if name == "" || utf8.RuneCountInString(name) > 16 {
		p.deliver(errorMsg("name must be 1-16 characters"))
		return
	}
	if existing := r.byName(name); existing != nil && existing != m {
		p.deliver(errorMsg("name already taken"))
		return
	}

	oldName := m.name
	m.name = name
	p.name = name
	if r.host == oldName {
		r.host = name
	}
	r.broadcastState()
}

func (r *Room) addPlayer(p *Player) error {
	if m := r.byName(p.name); m != nil {
		if m.player != nil {
			return errors.New("name already taken")
		}
		m.player = p // reconnecting mid-game keeps their score
		if p.character != "" {
			m.character = p.character
		}
		if r.phase == phaseRound {
			p.deliver(r.current)
		}
		r.broadcastState()
		return nil
	}

	if r.phase != phaseLobby {
		return errors.New("game already started")
	}
	if len(r.members) >= r.mode.MaxPlayers {
		return errors.New("room is full")
	}

	r.members = append(r.members, &member{player: p, name: p.name, character: p.character})
	if r.host == "" {
		r.host = p.name
	}
	r.broadcastState()
	return nil
}

func (r *Room) removePlayer(p *Player) {
	m := r.byPlayer(p)
	if m == nil {
		return
	}

	if r.phase == phaseLobby {
		r.members = slices.DeleteFunc(r.members, func(x *member) bool { return x == m })
	} else {
		m.player = nil // keep the score in case they reconnect
	}

	connected := r.connected()
	if len(connected) == 0 {
		r.close()
		return
	}
	if r.host == m.name {
		r.host = connected[0].name
	}
	r.broadcastState()

	if r.phase == phaseRound && r.allGuessed() {
		r.endRound()
	}
}

func (r *Room) close() {
	r.closed = true
	if r.audioID != "" {
		r.audio.delete(r.audioID)
	}
	r.onEmpty()
}

func (r *Room) onStart(p *Player) {
	switch {
	case p.name != r.host:
		p.deliver(errorMsg("only the host can start"))
	case r.phase != phaseLobby:
		p.deliver(errorMsg("game already running"))
	case !r.solo && len(r.connected()) < r.mode.MinPlayers:
		p.deliver(errorMsg(fmt.Sprintf("need at least %d players", r.mode.MinPlayers)))
	default:
		for _, m := range r.members {
			m.score = 0
		}
		r.round = 0
		r.startRound()
	}
}

func (r *Room) startRound() {
	r.round++
	r.setPhase(phaseRound)

	// The pool is already random, so the first `count` sounds are the answer.
	pool := r.pickSounds(min(numChoices, len(r.sounds)))
	count := min(overlapFor(r.round), len(pool))
	r.answer = soundNames(pool[:count])
	r.audioID = r.audio.put(pool[:count])

	r.choices = soundNames(pool)
	rand.Shuffle(len(r.choices), func(i, j int) {
		r.choices[i], r.choices[j] = r.choices[j], r.choices[i]
	})

	for _, m := range r.members {
		m.picks = nil
		m.guessed = false
	}

	r.roundStart = time.Now()
	r.current = roundStartOut{
		Type:        "round_start",
		Round:       r.round,
		TotalRounds: r.mode.TotalRounds,
		AudioURL:    "/audio/" + r.audioID,
		Choices:     r.choices,
		Count:       count,
		EndsAt:      r.roundStart.Add(roundTime).UnixMilli(),
	}
	r.broadcast(r.current)
	r.broadcastState()
	r.after(roundTime, r.endRound)
}

func (r *Room) onGuess(p *Player, picks []string) {
	m := r.byPlayer(p)
	switch {
	case m == nil || r.phase != phaseRound:
		p.deliver(errorMsg("not accepting guesses right now"))
		return
	case m.guessed:
		p.deliver(errorMsg("already guessed this round"))
		return
	}

	picks = slices.Compact(slices.Sorted(slices.Values(picks)))
	if len(picks) == 0 || len(picks) > len(r.answer) {
		p.deliver(errorMsg(fmt.Sprintf("pick 1 to %d sounds", len(r.answer))))
		return
	}
	for _, pick := range picks {
		if !slices.Contains(r.choices, pick) {
			p.deliver(errorMsg("not a choice: " + pick))
			return
		}
	}

	m.picks = picks
	m.guessed = true
	m.guessedAt = time.Now()
	r.broadcastState()

	if r.allGuessed() {
		r.endRound()
	}
}

func (r *Room) endRound() {
	r.setPhase(phaseReveal)
	r.audio.delete(r.audioID)
	r.audioID = ""

	results := make([]resultOut, 0, len(r.members))
	for _, m := range r.members {
		pts := r.points(m)
		m.score += pts
		results = append(results, resultOut{Name: m.name, Character: m.character, Picks: m.picks, Points: pts})
	}
	r.broadcast(roundEndOut{Type: "round_end", Answer: r.answer, Results: results})
	r.broadcastState()

	if r.round >= r.mode.TotalRounds {
		r.after(revealTime, r.endGame)
	} else {
		r.after(revealTime, r.startRound)
	}
}

func (r *Room) endGame() {
	board := make([]scoreOut, 0, len(r.members))
	for _, m := range r.members {
		board = append(board, scoreOut{Name: m.name, Character: m.character, Score: m.score})
	}
	slices.SortStableFunc(board, func(a, b scoreOut) int { return cmp.Compare(b.Score, a.Score) })

	r.setPhase(phaseLobby)
	r.members = slices.DeleteFunc(r.members, func(m *member) bool { return m.player == nil })
	r.broadcast(gameOverOut{Type: "game_over", Leaderboard: board})
	r.broadcastState()
}

func (r *Room) points(m *member) int {
	if !m.guessed {
		return 0
	}
	left := max(roundTime-m.guessedAt.Sub(r.roundStart), 0)
	bonus := int(maxSpeedBonus * left / roundTime)

	pts := 0
	for _, pick := range m.picks {
		if slices.Contains(r.answer, pick) {
			pts += pointsCorrect + bonus
		}
	}
	return pts
}

func (r *Room) setPhase(phase string) {
	r.phase = phase
	r.phaseID++
}

func (r *Room) allGuessed() bool {
	for _, m := range r.connected() {
		if !m.guessed {
			return false
		}
	}
	return true
}

func (r *Room) broadcast(msg any) {
	for _, m := range r.connected() {
		m.player.deliver(msg)
	}
}

func (r *Room) broadcastState() {
	players := make([]playerOut, 0, len(r.members))
	for _, m := range r.members {
		players = append(players, playerOut{
			Name:      m.name,
			Character: m.character,
			Score:     m.score,
			Connected: m.player != nil,
			Guessed:   m.guessed,
		})
	}
	r.broadcast(stateOut{
		Type:        "room_state",
		Code:        r.code,
		Mode:        r.mode.ID,
		MinPlayers:  r.mode.MinPlayers,
		MaxPlayers:  r.mode.MaxPlayers,
		Phase:       r.phase,
		Host:        r.host,
		Round:       r.round,
		TotalRounds: r.mode.TotalRounds,
		Players:     players,
	})
}

func (r *Room) connected() []*member {
	var out []*member
	for _, m := range r.members {
		if m.player != nil {
			out = append(out, m)
		}
	}
	return out
}

func (r *Room) byName(name string) *member {
	for _, m := range r.members {
		if m.name == name {
			return m
		}
	}
	return nil
}

func (r *Room) byPlayer(p *Player) *member {
	for _, m := range r.members {
		if m.player == p {
			return m
		}
	}
	return nil
}

func (r *Room) pickSounds(n int) []Sound {
	out := make([]Sound, n)
	for i, idx := range rand.Perm(len(r.sounds))[:n] {
		out[i] = r.sounds[idx]
	}
	return out
}

// overlapFor makes later rounds harder: 2 sounds, then 3, then 4.
func overlapFor(round int) int {
	switch {
	case round <= 3:
		return 2
	case round <= 7:
		return 3
	default:
		return 4
	}
}

func soundNames(sounds []Sound) []string {
	names := make([]string, len(sounds))
	for i, s := range sounds {
		names[i] = s.Name
	}
	return names
}
