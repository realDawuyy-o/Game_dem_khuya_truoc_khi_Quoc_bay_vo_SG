package main

// inMsg is every client → server message. One flat struct; each type only uses the fields it needs.
type inMsg struct {
	Type  string   `json:"type"`            // create, join, start, guess
	Name  string   `json:"name,omitempty"`  // create, join
	Room  string   `json:"room,omitempty"`  // join
	Picks []string `json:"picks,omitempty"` // guess
}

type errorOut struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

func errorMsg(text string) errorOut {
	return errorOut{Type: "error", Message: text}
}

type playerOut struct {
	Name      string `json:"name"`
	Score     int    `json:"score"`
	Connected bool   `json:"connected"`
	Guessed   bool   `json:"guessed"`
}

type stateOut struct {
	Type        string      `json:"type"` // room_state
	Code        string      `json:"code"`
	Phase       string      `json:"phase"`
	Host        string      `json:"host"`
	Round       int         `json:"round"`
	TotalRounds int         `json:"totalRounds"`
	Players     []playerOut `json:"players"`
}

type roundStartOut struct {
	Type        string   `json:"type"` // round_start
	Round       int      `json:"round"`
	TotalRounds int      `json:"totalRounds"`
	AudioURL    string   `json:"audioUrl"`
	Choices     []string `json:"choices"`
	Count       int      `json:"count"`  // how many sounds are in the mix
	EndsAt      int64    `json:"endsAt"` // unix ms
}

type resultOut struct {
	Name   string   `json:"name"`
	Picks  []string `json:"picks"`
	Points int      `json:"points"`
}

type roundEndOut struct {
	Type    string      `json:"type"` // round_end
	Answer  []string    `json:"answer"`
	Results []resultOut `json:"results"`
}

type scoreOut struct {
	Name  string `json:"name"`
	Score int    `json:"score"`
}

type gameOverOut struct {
	Type        string     `json:"type"` // game_over
	Leaderboard []scoreOut `json:"leaderboard"`
}
