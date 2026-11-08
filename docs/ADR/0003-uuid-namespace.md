# 0003 - Use `@VitalyOstanin` as the uuid namespace

Status: Accepted

## Context

The author's other extensions use `<name>@VitalyOstanin` (the GitHub username).

## Decision

Use `sysfs-sensors@VitalyOstanin` as the uuid. It must match the `uuid` field in
`metadata.json`, the directory name under `~/.local/share/gnome-shell/extensions/`
and the entry in `org.gnome.shell enabled-extensions`.

## Consequences

- Consistent with the author's other extensions.
- The uuid is fixed from the first submission to extensions.gnome.org.
