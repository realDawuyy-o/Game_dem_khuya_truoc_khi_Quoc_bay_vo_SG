package main

import (
	"net/http"

	"github.com/coder/websocket"
)

func routes(cfg Config, hub *Hub, audio *AudioStore) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ws", handleWS(hub, cfg.AllowedOrigins))
	mux.HandleFunc("GET /audio/{id}", handleAudio(audio))
	mux.HandleFunc("GET /health", handleHealth)
	return mux
}

func handleWS(hub *Hub, origins []string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: origins})
		if err != nil {
			return // Accept already wrote the error response
		}
		hub.serve(r.Context(), conn)
	}
}

func handleAudio(audio *AudioStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		wav, ok := audio.get(r.PathValue("id"))
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "audio/wav")
		w.Header().Set("Cache-Control", "no-store")
		w.Write(wav)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("ok"))
}
