// SPDX-License-Identifier: AGPL-3.0-or-later

package cmd

import (
	"runtime"

	"github.com/spf13/cobra"

	"github.com/hearthapp/hearth/hearth_rexctl/internal/engine"
	"github.com/hearthapp/hearth/hearth_rexctl/internal/instance"
)

type versionJSON struct {
	Version string  `json:"version"`
	Commit  string  `json:"commit"`
	Go      string  `json:"go"`
	OS      string  `json:"os"`
	Arch    string  `json:"arch"`
	Hearth  *string `json:"hearth"`

	MinPodman   string `json:"min_podman"`
	MinDocker   string `json:"min_docker"`
	StateSchema int    `json:"state_schema"`
}

func newVersionCmd(app *App) *cobra.Command {
	c := &cobra.Command{
		Use:   "version",
		Short: "Show the rexctl and Hearth versions",
		Args:  noArgs,
		RunE: func(c *cobra.Command, _ []string) error {
			v := versionJSON{Version: app.Version, Commit: app.Commit, Go: runtime.Version(), OS: runtime.GOOS, Arch: runtime.GOARCH,
				MinPodman: engine.MinPodman, MinDocker: engine.MinDocker, StateSchema: instance.StateSchema}
			if inst, err := app.Instance(); err == nil && inst.State != nil && inst.State.Release != "" {
				r := inst.State.Release
				v.Hearth = &r
			}
			if app.Flags.JSON {
				return app.UI.JSON(v)
			}
			app.UI.Result("rexctl " + v.Version)
			if v.Hearth != nil {
				app.UI.Result("Hearth " + *v.Hearth)
			}
			return nil
		},
	}
	app.jsonFlag(c)
	return c
}
