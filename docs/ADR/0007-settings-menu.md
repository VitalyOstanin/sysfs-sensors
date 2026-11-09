# 0007 - Open the preferences from a panel menu

Status: Accepted

Supersedes the "no menu" part of [0002](0002-show-cpu-package-and-fan.md).

## Context

ADR 0006 added a preferences window, but it could only be opened from the
Extensions app or with `gnome-extensions prefs`. The author asked to reach it
from the indicator in the top panel.

## Decision

The indicator gets a regular panel menu (`PanelMenu.Button` with its menu) that
holds one item, "Settings", which calls `Extension.openPreferences()`. A click
on the indicator opens the menu; it does not open the window directly, so a
stray click does not pop up a window and the menu can take more items later.

The label also gets its own horizontal padding (`.sysfs-sensors-label`):
panel layouts that zero the button padding (for example dash-to-panel with
`tray-padding` 0) otherwise draw the hover highlight narrower than the text. The padding is
relative to the text, so the highlight follows two- and three-digit values;
tabular digits (`font-feature-settings: "tnum"`) keep equal-length values
the same width.

## Consequences

- `PopupMenu.addAction(title, callback, icon)` and
  `Extension.openPreferences()` exist with the same signature in GNOME 45-51.
- The menu is destroyed together with the indicator in `disable()` (ADR 0004).
