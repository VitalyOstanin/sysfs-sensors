// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// Ids match the temperature-unit choices in the schema.
const UNITS = [
  { id: "celsius", label: "Celsius (°C)" },
  { id: "fahrenheit", label: "Fahrenheit (°F)" },
];

// Bounds come from the key's <range> in the schema.
function spinRow(settings, key, title, subtitle) {
  const [, [lower, upper]] = settings.settings_schema
    .get_key(key)
    .get_range()
    .recursiveUnpack();
  const row = new Adw.SpinRow({
    title,
    subtitle,
    adjustment: new Gtk.Adjustment({ lower, upper, step_increment: 1 }),
  });
  settings.bind(key, row, "value", Gio.SettingsBindFlags.DEFAULT);
  return row;
}

export default class SysfsSensorsPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    const page = new Adw.PreferencesPage();

    const display = new Adw.PreferencesGroup({ title: "Display" });

    const fanRow = new Adw.SwitchRow({
      title: "Show fan speed",
      subtitle: "Fan RPM next to the CPU temperature",
    });
    settings.bind("show-fan", fanRow, "active", Gio.SettingsBindFlags.DEFAULT);
    display.add(fanRow);

    const unitRow = new Adw.ComboRow({
      title: "Temperature unit",
      model: Gtk.StringList.new(UNITS.map((u) => u.label)),
      selected: UNITS.findIndex(
        (u) => u.id === settings.get_string("temperature-unit"),
      ),
    });
    unitRow.connect("notify::selected", () =>
      settings.set_string("temperature-unit", UNITS[unitRow.selected].id),
    );
    display.add(unitRow);

    display.add(
      spinRow(settings, "update-interval", "Update interval", "Seconds"),
    );
    page.add(display);

    const heat = new Adw.PreferencesGroup({
      title: "Heat highlight",
      description: "CPU temperature in °C at which the panel text changes color",
    });
    heat.add(spinRow(settings, "warm-threshold", "Warm", "Yellow"));
    heat.add(spinRow(settings, "hot-threshold", "Hot", "Red"));
    page.add(heat);

    window.add(page);
  }
}
