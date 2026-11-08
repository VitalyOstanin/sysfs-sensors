# CLAUDE.md

Guidance for AI agents and contributors working on this extension.

## Table of Contents

- [Project overview](#project-overview)
- [Hard constraint: GNOME 45-51](#hard-constraint-gnome-45-51)
- [Hard constraint: no subprocesses, no sync I/O](#hard-constraint-no-subprocesses-no-sync-io)
- [API surface used](#api-surface-used)
- [Procedure: verify against a GNOME version](#procedure-verify-against-a-gnome-version)
- [Syntax check](#syntax-check)
- [Manual testing](#manual-testing)
- [Files](#files)

## Project overview

`sysfs-sensors` shows the CPU package temperature and the fan speed in the top
panel, read from `/sys/class/hwmon`. The scope is deliberately two numbers that
answer "is the laptop getting hot?", with a heat highlight and five settings
(ADR 0006). Read the ADRs in [docs/ADR](docs/ADR)
before widening it.

## Hard constraint: GNOME 45-51

`metadata.json` declares `shell-version` 45 through 51. Every change MUST keep
the extension working across all of them. Verify any Shell symbol against each
declared branch (see the procedure below) instead of relying on the locally
installed version.

## Hard constraint: no subprocesses, no sync I/O

The reason this extension exists is that other sensors extensions spawn
`sensors`, `nvme` or `cat` on the main thread and stall the shell. Do not add
`GLib.spawn_*`, `Gio.Subprocess` or synchronous file reads
(`GLib.file_get_contents`, `Gio.File.load_contents`). Read sysfs with the
promisified async GIO calls already used in `extension.js`. See
[ADR 0001](docs/ADR/0001-read-sysfs-asynchronously.md).

## API surface used

| Symbol                                                   | Source      | Notes                                         |
| -------------------------------------------------------- | ----------- | --------------------------------------------- |
| `Extension` (ESM base class), `this.uuid`, `this.metadata` | gnome-shell | `js/extensions/extension.js`, since 45        |
| `PanelMenu.Button(menuAlignment, nameText, dontCreateMenu)` | gnome-shell | `js/ui/panelMenu.js`, same signature 45-51    |
| `Main.panel.addToStatusArea(role, indicator, position, box)` | gnome-shell | `js/ui/panel.js`, same signature 45-51        |
| `St.Label`, `Clutter.ActorAlign.CENTER`                  | St/Clutter  | stable                                        |
| `Gio._promisify`                                         | GJS         | available in every GJS shipped with 45-51     |
| `Gio.File.load_contents_async`, `enumerate_children_async`, `Gio.FileEnumerator.next_files_async` | GIO | stable |
| `GLib.timeout_add_seconds`, `GLib.Source.remove`         | GLib        | stable                                        |
| `Extension.getSettings()`, `connectObject`/`disconnectObject` on `Gio.Settings` | gnome-shell | since 45 |
| `ExtensionPreferences.fillPreferencesWindow`, `getSettings()` | gnome-shell | `js/extensions/prefs.js`, since 45 |
| `Adw.SwitchRow`, `Adw.SpinRow`, `Adw.ComboRow`, `Adw.PreferencesGroup` | libadwaita | SwitchRow and SpinRow since 1.4 (GNOME 45) |

Sysfs interface: `/sys/class/hwmon/hwmon*/name`, `temp*_label`, `temp*_input`
(millidegrees Celsius), `fan*_input` (RPM). Documented in the kernel
`Documentation/hwmon/sysfs-interface.rst`.

Verified on branches `gnome-45`..`gnome-51` on 2026-11-09.

## Procedure: verify against a GNOME version

```sh
cd ~/devel/gnome/gnome-shell   # or a treeless clone of GNOME/gnome-shell
git fetch origin
for v in 45 46 47 48 49 50 51; do
  echo "=== gnome-$v ==="
  git grep -hE '_init\(menuAlignment, nameText, dontCreateMenu\)' origin/gnome-$v -- js/ui/panelMenu.js
  git grep -hE 'addToStatusArea\(role, indicator, position, box\)' origin/gnome-$v -- js/ui/panel.js
done
```

## Syntax check

```sh
node --check extension.js && node --check prefs.js
glib-compile-schemas --strict schemas
```

## Manual testing

1. Symlink the repo into `~/.local/share/gnome-shell/extensions/`.
2. Re-login (Wayland) and `gnome-extensions enable sysfs-sensors@VitalyOstanin`.
3. Compare the panel with
   `cat /sys/class/hwmon/hwmon*/temp*_input /sys/class/hwmon/hwmon*/fan*_input`.
4. Confirm that the shell spawns nothing:
   `sudo bpftrace -e 'tracepoint:sched:sched_process_exec /curtask->real_parent->tgid == PID/ { printf("%s\n", str(args->filename)); }'`
   with the `gnome-shell` pid; no output is expected from this extension.
5. Disable and enable it a few times; check
   `journalctl -b /usr/bin/gnome-shell -p warning` for errors.

## Files

- `extension.js` — the panel indicator and sensor reads.
- `prefs.js` — the preferences window.
- `schemas/` — the GSettings schema (`gschemas.compiled` is generated, not tracked).
- `stylesheet.css` — warm and hot text colors.
- `metadata.json` — uuid, name, description, `shell-version`, `settings-schema`, `version-name`.
- `docs/ADR/` — architecture decision records.
