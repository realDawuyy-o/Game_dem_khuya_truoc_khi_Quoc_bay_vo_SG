package main

import (
	"log"
	"net/http"
)

func main() {
	cfg := loadConfig()

	sounds, err := loadSounds(cfg.SoundsDir)
	if err != nil {
		log.Fatalf("load sounds: %v", err)
	}

	audio := newAudioStore()
	hub := newHub(sounds, audio)

	log.Printf("listening on :%s with %d sounds", cfg.Port, len(sounds))
	log.Fatal(http.ListenAndServe(":"+cfg.Port, routes(cfg, hub, audio)))
}
