package main

const defaultGameModeID = "sound_mix"

type gameModeSpec struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	MinPlayers  int    `json:"minPlayers"`
	MaxPlayers  int    `json:"maxPlayers"`
	TotalRounds int    `json:"totalRounds"`
	SoloAllowed bool   `json:"soloAllowed"`
	Available   bool   `json:"available"`
}

var gameModeCatalog = []gameModeSpec{
	{
		ID:          defaultGameModeID,
		Name:        "Sound Mix",
		Description: "Listen closely and pick out the sounds in each mix.",
		MinPlayers:  2,
		MaxPlayers:  32,
		TotalRounds: 10,
		SoloAllowed: true,
		Available:   true,
	},
	{
		ID:          "beat_builder",
		Name:        "Beat Builder",
		Description: "A multiplayer rhythm-game template for a future mode.",
		MinPlayers:  2,
		MaxPlayers:  32,
		TotalRounds: 10,
	},
	{
		ID:          "animal_groove",
		Name:        "Animal Groove",
		Description: "A multiplayer music-party template for a future mode.",
		MinPlayers:  2,
		MaxPlayers:  32,
		TotalRounds: 10,
	},
}

func findGameMode(id string) (gameModeSpec, bool) {
	for _, mode := range gameModeCatalog {
		if mode.ID == id {
			return mode, true
		}
	}
	return gameModeSpec{}, false
}
