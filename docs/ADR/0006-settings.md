# 0006 - Add a small set of settings

Status: Accepted

Supersedes the "no settings" part of [0002](0002-show-cpu-package-and-fan.md).

## Context

ADR 0002 shipped without settings. The author asked to be able to hide the fan
speed while keeping it on by default for other users, and to see at a glance
whether the laptop is getting hot without reading the number.

## Decision

A GSettings schema `org.gnome.shell.extensions.sysfs-sensors` with five keys
and a preferences window (`prefs.js`, libadwaita rows):

| Key                | Type     | Default   | Effect                                         |
| ------------------ | -------- | --------- | ---------------------------------------------- |
| `show-fan`         | boolean  | `true`    | show the fan speed                             |
| `update-interval`  | uint     | `5`       | seconds between reads, 1-60                    |
| `temperature-unit` | string   | `celsius` | `celsius` or `fahrenheit`                      |
| `warm-threshold`   | uint     | `80`      | from this °C the text is yellow (`.sysfs-sensors-warm`) |
| `hot-threshold`    | uint     | `90`      | from this °C the text is red (`.sysfs-sensors-hot`)     |

Thresholds are always in °C and compared with the CPU package temperature.
Every change applies immediately: `update-interval` restarts the timer, other
keys trigger a refresh.

Panel position and sensor selection are deliberately not configurable: the
scope of ADR 0002 (two numbers) stays.

## Consequences

- The settings signal is connected with `connectObject` and disconnected in
  `disable()` (ADR 0004).
- `prefs.js` uses `Adw.SwitchRow` and `Adw.SpinRow`, available since
  libadwaita 1.4, which every GNOME 45-51 release ships.
