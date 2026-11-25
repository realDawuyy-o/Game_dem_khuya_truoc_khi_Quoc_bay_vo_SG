package main

import (
	"log"
	"net/http"
	"time"
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
	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           routes(cfg, hub, audio),
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Fatal(server.ListenAndServe())
}
