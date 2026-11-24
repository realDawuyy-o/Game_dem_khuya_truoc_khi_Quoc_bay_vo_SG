package main

import (
	"os"
	"strings"
)

type Config struct {
	Port      string
	SoundsDir string
	// Host patterns for the frontend, e.g. "localhost:*,mygame.vercel.app".
	AllowedOrigins []string
}

func loadConfig() Config {
	return Config{
		Port:           envOr("PORT", "8080"),
		SoundsDir:      envOr("SOUNDS_DIR", "sounds"),
		AllowedOrigins: strings.Split(envOr("ALLOWED_ORIGINS", "localhost:*"), ","),
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
