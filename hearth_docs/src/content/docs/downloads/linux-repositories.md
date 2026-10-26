---
# SPDX-License-Identifier: AGPL-3.0-or-later
title: Linux repositories
description: How to add the apt, dnf, pacman and Flatpak repositories Hearth publishes.
---

Hearth publishes apt, dnf, pacman and Flatpak repositories, all signed with the key whose fingerprint is `09D01339EE128925F75E675C855C5BDE34D205D2`. You pick the channel with the entry file on apt and dnf, by package name on pacman and by app ID on Flatpak.

| Package manager | Pick stable with | Pick canary with |
| --- | --- | --- |
| apt | `hearth.sources` | `hearth-canary.sources` |
| dnf | `hearth.repo` | `hearth-canary.repo` |
| pacman | `hearth` | `hearth-canary` |
| Flatpak | `app.hearth.Hearth` | `app.hearth.HearthCanary` |

## Debian and Ubuntu

```sh
sudo install -d -m 0755 /etc/apt/keyrings
sudo curl -fsSL -o /etc/apt/keyrings/hearth-archive-keyring.gpg \
  https://pkgs.hearth.com/keys/hearth-archive-keyring.gpg
sudo curl -fsSL -o /etc/apt/sources.list.d/hearth.sources \
  https://pkgs.hearth.com/deb/hearth.sources
sudo apt update && sudo apt install hearth
```

A `.deb` you downloaded only gets updates after you add the entry for its channel. For canary, add the canary entry and install `hearth-canary`.

```sh
sudo curl -fsSL -o /etc/apt/sources.list.d/hearth-canary.sources \
  https://pkgs.hearth.com/deb/hearth-canary.sources
sudo apt update && sudo apt install hearth-canary
```

## Fedora and RHEL

RHEL, Rocky, Alma and CentOS Stream need `sudo dnf install epel-release` first, because the package depends on `libXScrnSaver`.

```sh
sudo curl -fsSL -o /etc/yum.repos.d/hearth.repo \
  https://pkgs.hearth.com/rpm/hearth.repo
sudo dnf install hearth
```

dnf asks you to import the signing key on the first install, once for the repository and once for the package. Check that the fingerprint matches the one above both times.

For canary, add the canary entry and install `hearth-canary`.

```sh
sudo curl -fsSL -o /etc/yum.repos.d/hearth-canary.repo \
  https://pkgs.hearth.com/rpm/hearth-canary.repo
sudo dnf install hearth-canary
```

dnf keeps the repository metadata for six hours, so a new build can take up to six hours to show up. Run `sudo dnf --refresh upgrade` to check sooner.

## Arch Linux

Add the signing key to the pacman keyring once, or pacman refuses the repository with `unknown trust`.

```sh
sudo pacman-key --init
curl -fsSL -o /tmp/hearth-archive-keyring.asc \
  https://pkgs.hearth.com/keys/hearth-archive-keyring.asc
sudo pacman-key --add /tmp/hearth-archive-keyring.asc
sudo pacman-key --lsign-key 09D01339EE128925F75E675C855C5BDE34D205D2
```

Then add the repository and install `hearth` or `hearth-canary`.

```sh
sudo tee -a /etc/pacman.conf >/dev/null <<'REPO'

[hearth]
SigLevel = Required TrustedOnly
Server = https://pkgs.hearth.com/arch/$repo/os/$arch
REPO
sudo pacman -Syu hearth
```

## Flatpak

Stable is also on Flathub as `app.hearth.Hearth`, but canary is only in the Hearth repository. The reference file adds a remote called `hearth` and installs the app.

```sh
flatpak install https://pkgs.hearth.com/flatpak/hearth.flatpakref
```

For canary, use the canary reference file.

```sh
flatpak install https://pkgs.hearth.com/flatpak/hearth-canary.flatpakref
```
