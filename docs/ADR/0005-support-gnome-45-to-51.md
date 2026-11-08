# 0005 - Declare and verify support for GNOME 45-51

Status: Accepted

## Context

The author's extensions target GNOME 45-51.

## Decision

Declare `shell-version` 45-51. Verified on branches `gnome-45`..`gnome-51`:
`PanelMenu.Button._init(menuAlignment, nameText, dontCreateMenu)` and
`Panel.addToStatusArea(role, indicator, position, box)` have the same
signatures; the rest is GIO, GLib, St and Clutter API stable across the range.

## Consequences

- One code base without per-version branches.
- The procedure in [CLAUDE.md](../../CLAUDE.md) must be re-run for each new
  GNOME release.
