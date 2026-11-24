package main

import (
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// All sounds must be 16-bit PCM mono at this rate so they can be mixed by plain addition.
const sampleRate = 22050

var le = binary.LittleEndian

type Sound struct {
	Name    string // file name without .wav, also the answer
	Samples []int16
}

func loadSounds(dir string) ([]Sound, error) {
	paths, err := filepath.Glob(filepath.Join(dir, "*.wav"))
	if err != nil {
		return nil, err
	}
	if len(paths) == 0 {
		return nil, fmt.Errorf("no .wav files in %s", dir)
	}

	sounds := make([]Sound, 0, len(paths))
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			return nil, err
		}
		samples, err := parseWAV(data)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", p, err)
		}
		name := strings.TrimSuffix(filepath.Base(p), ".wav")
		sounds = append(sounds, Sound{Name: name, Samples: samples})
	}
	return sounds, nil
}

func parseWAV(data []byte) ([]int16, error) {
	if len(data) < 12 || string(data[0:4]) != "RIFF" || string(data[8:12]) != "WAVE" {
		return nil, errors.New("not a WAV file")
	}

	fmtOK := false
	for p := 12; p+8 <= len(data); {
		id := string(data[p : p+4])
		size := int(le.Uint32(data[p+4 : p+8]))
		if size > len(data)-p-8 {
			return nil, errors.New("truncated chunk")
		}
		body := data[p+8 : p+8+size]

		switch id {
		case "fmt ":
			if size < 16 {
				return nil, errors.New("bad fmt chunk")
			}
			format, channels := le.Uint16(body[0:2]), le.Uint16(body[2:4])
			rate, bits := le.Uint32(body[4:8]), le.Uint16(body[14:16])
			if format != 1 || channels != 1 || rate != sampleRate || bits != 16 {
				return nil, fmt.Errorf("need 16-bit PCM mono %d Hz, got format=%d channels=%d rate=%d bits=%d",
					sampleRate, format, channels, rate, bits)
			}
			fmtOK = true
		case "data":
			if !fmtOK {
				return nil, errors.New("data chunk before fmt chunk")
			}
			samples := make([]int16, size/2)
			for i := range samples {
				samples[i] = int16(le.Uint16(body[2*i:]))
			}
			return samples, nil
		}
		// Chunks are padded to an even size; ffmpeg also adds extra ones like LIST.
		p += 8 + size + size%2
	}
	return nil, errors.New("no data chunk")
}

func mix(sounds []Sound) []int16 {
	n := 0
	for _, s := range sounds {
		n = max(n, len(s.Samples))
	}
	out := make([]int16, n)
	for i := range out {
		var sum int32
		for _, s := range sounds {
			if i < len(s.Samples) {
				sum += int32(s.Samples[i])
			}
		}
		out[i] = int16(min(max(sum, math.MinInt16), math.MaxInt16))
	}
	return out
}

func encodeWAV(samples []int16) []byte {
	dataSize := len(samples) * 2
	b := make([]byte, 44+dataSize)
	copy(b[0:], "RIFF")
	le.PutUint32(b[4:], uint32(36+dataSize))
	copy(b[8:], "WAVE")
	copy(b[12:], "fmt ")
	le.PutUint32(b[16:], 16) // fmt chunk size
	le.PutUint16(b[20:], 1)  // PCM
	le.PutUint16(b[22:], 1)  // mono
	le.PutUint32(b[24:], sampleRate)
	le.PutUint32(b[28:], sampleRate*2) // byte rate
	le.PutUint16(b[32:], 2)            // block align
	le.PutUint16(b[34:], 16)           // bits per sample
	copy(b[36:], "data")
	le.PutUint32(b[40:], uint32(dataSize))
	for i, s := range samples {
		le.PutUint16(b[44+2*i:], uint16(s))
	}
	return b
}

// AudioStore holds each round's mixed clip under a random ID so the URL doesn't reveal the answer.
type AudioStore struct {
	mu    sync.Mutex
	clips map[string][]byte
}

func newAudioStore() *AudioStore {
	return &AudioStore{clips: make(map[string][]byte)}
}

// put mixes the sounds and returns the ID to serve them under.
func (s *AudioStore) put(sounds []Sound) string {
	wav := encodeWAV(mix(sounds))
	id := rand.Text()
	s.mu.Lock()
	s.clips[id] = wav
	s.mu.Unlock()
	return id
}

func (s *AudioStore) get(id string) ([]byte, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	wav, ok := s.clips[id]
	return wav, ok
}

func (s *AudioStore) delete(id string) {
	s.mu.Lock()
	delete(s.clips, id)
	s.mu.Unlock()
}
