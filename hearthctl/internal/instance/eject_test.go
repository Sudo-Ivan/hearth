// SPDX-License-Identifier: AGPL-3.0-or-later

package instance

import (
	"encoding/json"
	"errors"
	"maps"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/sudo-ivan/hearth/hearthctl/internal/secrets"
	"github.com/sudo-ivan/hearth/hearthctl/internal/stack"
)

const (
	ejectedAt = "2026.10.0"
	shippedAt = "2026.11.0"
)

func hearthRefs(digit string) map[string]string {
	refs := map[string]string{}
	for _, svc := range []string{"api", "worker", "gateway", "media-proxy", "push", "static-proxy", "app-proxy", "admin", "snowflakes", "users", "gifs", "messages", "unfurl"} {
		refs[svc] = "ghcr.io/sudo-ivan/hearth-" + svc + "@sha256:" + strings.Repeat(digit, 64)
	}
	return refs
}

func TestMain(m *testing.M) {
	dir, err := os.MkdirTemp("", "hearthctl-imageset")
	if err != nil {
		panic(err)
	}
	data, err := json.Marshal(stack.ImageSet{Release: shippedAt, Images: hearthRefs("b")})
	if err != nil {
		panic(err)
	}
	path := filepath.Join(dir, "imageset.json")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		panic(err)
	}
	os.Setenv(stack.ImageSetEnv, path)
	code := m.Run()
	os.RemoveAll(dir)
	os.Exit(code)
}

func ejectedInstance(t *testing.T, declared *stack.Set, refs map[string]string) string {
	t.Helper()
	dir := t.TempDir()
	shipped := stack.Embedded()
	old := &stack.Set{Release: ejectedAt, Files: shipped.Files, Profiles: shipped.Profiles, Vars: shipped.Vars}
	if err := stack.WriteSet(filepath.Join(dir, StateDirName, ReleasesDir, ejectedAt, StackDir), old); err != nil {
		t.Fatal(err)
	}
	r, err := stack.Render(old, nil, hearthRefs("a"), "hearth", dir)
	if err != nil {
		t.Fatal(err)
	}
	compose, err := stack.RenderCompose(declared, refs, "hearth")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, stack.ComposeFile), compose, 0o644); err != nil {
		t.Fatal(err)
	}
	s := &State{
		Project:   "hearth",
		Release:   ejectedAt,
		Images:    Images{Release: ejectedAt, Refs: hearthRefs("a")},
		Settings:  map[string]string{},
		Secrets:   map[string]string{},
		Rendered:  r.Hashes,
		SetupDone: true,
		Ejected:   &Ejected{At: time.Now().UTC().Truncate(time.Second)},
	}
	if _, err := secrets.Mint(s.Secrets, false); err != nil {
		t.Fatal(err)
	}
	if err := s.Save(filepath.Join(dir, StateDirName, StateFileName)); err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestTakeoverOfEjectedInstanceNeverGoesBack(t *testing.T) {
	shipped := stack.Embedded()
	old := &stack.Set{Release: ejectedAt, Files: shipped.Files, Profiles: shipped.Profiles, Vars: shipped.Vars}

	t.Run("same release", func(t *testing.T) {
		s, r, err := Import(ejectedInstance(t, old, hearthRefs("a")), nil)
		if err != nil {
			t.Fatal(err)
		}
		if s.Release != ejectedAt || len(r.KeepAsMine) != 0 {
			t.Fatalf("release %s, kept %v", s.Release, r.KeepAsMine)
		}
	})

	t.Run("updated to the release hearthctl ships", func(t *testing.T) {
		s, r, err := Import(ejectedInstance(t, shipped, hearthRefs("b")), nil)
		if err != nil {
			t.Fatal(err)
		}
		if s.Release != shippedAt || s.Images.Release != shippedAt || !maps.Equal(s.Images.Refs, hearthRefs("b")) {
			t.Fatalf("took over on %s with %v", s.Release, s.Images)
		}
		if s.PreviousRelease != ejectedAt || len(r.KeepAsMine) != 0 {
			t.Fatalf("previous %s, kept %v", s.PreviousRelease, r.KeepAsMine)
		}
	})

	t.Run("updated to a release hearthctl doesn't know", func(t *testing.T) {
		dir := ejectedInstance(t, shipped, hearthRefs("c"))
		_, _, err := Import(dir, nil)
		var ae *AdoptError
		if !errors.As(err, &ae) {
			t.Fatalf("took over an instance on unknown images: %v", err)
		}
		data, err := os.ReadFile(filepath.Join(dir, StateDirName, StateFileName))
		if err != nil {
			t.Fatal(err)
		}
		s, err := ParseState(data, dir)
		if err != nil || s.Ejected == nil || s.Release != ejectedAt {
			t.Fatalf("state changed after the refusal: %v", err)
		}
	})
}
