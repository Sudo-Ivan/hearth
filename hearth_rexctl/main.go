// SPDX-License-Identifier: AGPL-3.0-or-later

package main

import (
	"os"

	"github.com/hearthapp/hearth/hearth_rexctl/cmd"
)

var (
	version = "dev"
	commit  = ""
)

func main() {
	os.Exit(cmd.Execute(version, commit))
}
