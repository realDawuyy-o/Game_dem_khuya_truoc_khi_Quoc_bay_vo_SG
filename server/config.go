package main

import (
	"os"
	"strings"
)

type Config struct {
	Port      string
	SoundsDir string
	WebDir    string
	// Host patterns for the frontend, e.g. "localhost:*,mygame.vercel.app".
	AllowedOrigins []string
}

func loadConfig() Config {
	var allowedOrigins []string
	for _, origin := range strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			allowedOrigins = append(allowedOrigins, origin)
		}
	}

	return Config{
		Port:           envOr("PORT", "8080"),
		SoundsDir:      envOr("SOUNDS_DIR", "../sound_library"),
		WebDir:         envOr("WEB_DIR", "../web"),
		AllowedOrigins: allowedOrigins,
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
