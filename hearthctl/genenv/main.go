// SPDX-License-Identifier: AGPL-3.0-or-later

// Command genenv prints the self-host bundle's .env.example to stdout.
package main

import (
	"fmt"

	"github.com/sudo-ivan/hearth/hearthctl/internal/instance"
)

func main() {
	fmt.Print(instance.BundleEnv())
}
