package main

import (
	"encoding/binary"
	"path/filepath"
	"reflect"
	"testing"
)

func TestLoadSoundsSupportsBundledWAVFiles(t *testing.T) {
	sounds, err := loadSounds(filepath.Join("..", "sound_library"))
	if err != nil {
		t.Fatalf("load bundled sound library: %v", err)
	}
	if len(sounds) == 0 {
		t.Fatal("loaded no sounds")
	}
}

func TestParseWAVConvertsStereo44100ToMono22050(t *testing.T) {
	input := wavFixture(44100, 2, 16, []int16{
		1000, 3000,
		3000, 5000,
		5000, 7000,
		7000, 9000,
	})

	got, err := parseWAV(input)
	if err != nil {
		t.Fatalf("parse WAV: %v", err)
	}
	want := []int16{2000, 6000}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("samples = %v, want %v", got, want)
	}
}

func TestParseWAVConverts24BitPCMTo16Bit(t *testing.T) {
	input := wavFixture(22050, 1, 24, []int16{2000, -1000})
	got, err := parseWAV(input)
	if err != nil {
		t.Fatalf("parse WAV: %v", err)
	}
	want := []int16{2000, -1000}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("samples = %v, want %v", got, want)
	}
}

func TestParseWAVKeepsMonoSamplesAtTargetRate(t *testing.T) {
	want := []int16{1200, -3400, 5600}
	got, err := parseWAV(encodeWAV(want))
	if err != nil {
		t.Fatalf("parse WAV: %v", err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("samples = %v, want %v", got, want)
	}
}

func wavFixture(rate uint32, channels, bits uint16, samples []int16) []byte {
	bytesPerSample := int(bits / 8)
	frameSize := int(channels) * bytesPerSample
	dataSize := len(samples) * bytesPerSample
	wav := make([]byte, 44+dataSize)
	copy(wav[0:4], "RIFF")
	binary.LittleEndian.PutUint32(wav[4:8], uint32(len(wav)-8))
	copy(wav[8:12], "WAVE")
	copy(wav[12:16], "fmt ")
	binary.LittleEndian.PutUint32(wav[16:20], 16)
	binary.LittleEndian.PutUint16(wav[20:22], 1)
	binary.LittleEndian.PutUint16(wav[22:24], channels)
	binary.LittleEndian.PutUint32(wav[24:28], rate)
	binary.LittleEndian.PutUint32(wav[28:32], rate*uint32(frameSize))
	binary.LittleEndian.PutUint16(wav[32:34], uint16(frameSize))
	binary.LittleEndian.PutUint16(wav[34:36], bits)
	copy(wav[36:40], "data")
	binary.LittleEndian.PutUint32(wav[40:44], uint32(dataSize))
	for i, sample := range samples {
		encoded := int32(sample) << (bits - 16)
		for byteIndex := range bytesPerSample {
			wav[44+i*bytesPerSample+byteIndex] = byte(encoded >> (8 * byteIndex))
		}
	}
	return wav
}
