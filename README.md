# Sysfs Sensors

A minimal GNOME Shell extension that answers one question in the top panel: is
the laptop getting hot? It shows two numbers — the CPU package temperature and
the fan speed — read directly from `/sys/class/hwmon`.

## Table of Contents

- [What it shows](#what-it-shows)
- [Settings](#settings)
- [Why another sensors extension](#why-another-sensors-extension)
- [Compatibility](#compatibility)
- [Installation](#installation)
- [Development](#development)
- [License](#license)

## What it shows

```
68°C  3900 RPM
```

- **CPU package temperature** — the `Package id 0` input of the `coretemp`
  driver (Intel) or `Tctl` of `k10temp` (AMD). This is the main heat source and
  reacts to load within seconds.
- **Fan speed** — the first readable `fan*_input` of any hwmon chip. It tells
  whether the laptop is already working to cool itself.

Values refresh every 5 seconds. The text turns yellow from 80 °C and red from
90 °C. If a sensor is missing, its number is omitted; if neither is found, the
indicator stays hidden.

## Settings

| Setting          | Default    | Notes                                         |
| ---------------- | ---------- | --------------------------------------------- |
| Show fan speed   | on         | hide the RPM if you only want the temperature |
| Temperature unit | °C         | °C or °F                                      |
| Update interval  | 5 s        | 1-60 s                                        |
| Warm / Hot       | 80 / 90 °C | thresholds for the yellow and red highlight   |

Open them from the indicator menu (click the temperature, then Settings), with
`gnome-extensions prefs sysfs-sensors@VitalyOstanin` or from the Extensions app. Changes apply immediately.

## Why another sensors extension

Popular sensors extensions run external commands (`sensors`, `nvme`, `cat`,
`smartctl`) every few seconds, some of them synchronously on the shell's main
thread. Each such call forks the whole `gnome-shell` process and stalls input
and rendering while the shell waits for the child. On a busy session this shows
up as cursor stutter and libinput warnings like
`event processing lagging behind by 23ms, your system is too slow`.

This extension never spawns a process. Every value is a small sysfs file read
with asynchronous GIO calls, so the main loop is never blocked.

## Compatibility

GNOME Shell 45 through 51.

## Installation

From a checkout:

```sh
glib-compile-schemas schemas
ln -s "$PWD" ~/.local/share/gnome-shell/extensions/sysfs-sensors@VitalyOstanin
```

Then log out and back in (Wayland) and run:

```sh
gnome-extensions enable sysfs-sensors@VitalyOstanin
```

## Development

See [CLAUDE.md](CLAUDE.md) for the API surface, the version verification
procedure and manual testing. Design decisions are recorded in
[docs/ADR](docs/ADR).

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
