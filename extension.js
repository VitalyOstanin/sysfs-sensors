// SPDX-License-Identifier: GPL-2.0-or-later

import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

Gio._promisify(Gio.File.prototype, "load_contents_async");
Gio._promisify(Gio.File.prototype, "enumerate_children_async");
Gio._promisify(Gio.FileEnumerator.prototype, "next_files_async");

const HWMON_DIR = "/sys/class/hwmon";
const ENUMERATE_BATCH = 100;
const MILLIDEGREES_PER_DEGREE = 1000;
const INTERVAL_KEY = "update-interval";
const PARTS_SEPARATOR = "  ";

// hwmon chip name -> label of its whole-package temperature input.
const CPU_PACKAGE_LABELS = {
  coretemp: "Package id 0",
  k10temp: "Tctl",
};

// Keys match the temperature-unit choices in the schema.
const TEMPERATURE_FORMATTERS = {
  celsius: (c) => `${Math.round(c)}°C`,
  fahrenheit: (c) => `${Math.round((c * 9) / 5 + 32)}°F`,
};

// Each level maps to a .sysfs-sensors-<level> class in stylesheet.css.
const LEVEL_NONE = "";
const LEVEL_WARM = "warm";
const LEVEL_HOT = "hot";

const decoder = new TextDecoder();

function isCancelled(e) {
  return (
    e instanceof GLib.Error &&
    e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)
  );
}

async function readText(path, cancellable) {
  const [bytes] =
    await Gio.File.new_for_path(path).load_contents_async(cancellable);
  return decoder.decode(bytes).trim();
}

// Any error except cancellation reads as null.
async function readOptional(path, cancellable) {
  if (!path) return null;
  try {
    return await readText(path, cancellable);
  } catch (e) {
    if (isCancelled(e)) throw e;
    return null;
  }
}

async function readInteger(path, cancellable) {
  const text = await readOptional(path, cancellable);
  if (!text || !/^-?\d+$/.test(text)) return null;
  return Number(text);
}

async function listDir(path, cancellable) {
  const enumerator = await Gio.File.new_for_path(path).enumerate_children_async(
    "standard::name",
    Gio.FileQueryInfoFlags.NONE,
    GLib.PRIORITY_DEFAULT,
    cancellable,
  );
  const names = [];
  for (;;) {
    const infos = await enumerator.next_files_async(
      ENUMERATE_BATCH,
      GLib.PRIORITY_DEFAULT,
      cancellable,
    );
    if (infos.length === 0) break;
    for (const info of infos) names.push(info.get_name());
  }
  return names;
}

async function findCpuInput(dir, files, name, cancellable) {
  if (!Object.hasOwn(CPU_PACKAGE_LABELS, name)) return null;
  for (const file of files.filter((f) => /^temp\d+_label$/.test(f))) {
    const label = await readOptional(`${dir}/${file}`, cancellable);
    if (label === CPU_PACKAGE_LABELS[name])
      return `${dir}/${file.replace("_label", "_input")}`;
  }
  return null;
}

// Some acpi_fan devices expose fan1_input that fails with ENODEV, so a fan is
// taken only if its input can be read.
async function findReadableFan(dir, files, cancellable) {
  for (const file of files.filter((f) => /^fan\d+_input$/.test(f))) {
    if ((await readOptional(`${dir}/${file}`, cancellable)) !== null)
      return `${dir}/${file}`;
  }
  return null;
}

// hwmon numbering changes between boots, so sensors are looked up by chip
// name and label on every enable(). A chip that cannot be read is skipped.
async function findSensors(cancellable) {
  let cpu = null;
  let fan = null;

  for (const chip of await listDir(HWMON_DIR, cancellable)) {
    const dir = `${HWMON_DIR}/${chip}`;
    let files, name;
    try {
      files = await listDir(dir, cancellable);
      name = await readText(`${dir}/name`, cancellable);
    } catch (e) {
      if (isCancelled(e)) throw e;
      continue;
    }

    cpu ??= await findCpuInput(dir, files, name, cancellable);
    fan ??= await findReadableFan(dir, files, cancellable);
  }

  return { cpu, fan };
}

const SensorsIndicator = GObject.registerClass(
  class SensorsIndicator extends PanelMenu.Button {
    _init(name) {
      super._init(0.5, name, true /* dontCreateMenu */);
      this._label = new St.Label({
        text: "",
        y_align: Clutter.ActorAlign.CENTER,
      });
      this.add_child(this._label);
      this.hide();
    }

    setText(text, level) {
      this._label.text = text;
      this._label.style_class = level ? `sysfs-sensors-${level}` : "";
      this.visible = text !== "";
    }
  },
);

export default class SysfsSensors extends Extension {
  enable() {
    this._cancellable = new Gio.Cancellable();
    this._timerId = 0;
    this._sensors = null;
    this._updating = false;

    this._settings = this.getSettings();
    this._settings.connectObject(
      "changed",
      (_settings, key) => {
        if (key === INTERVAL_KEY) this._restartTimer();
        else this._refresh();
      },
      this,
    );

    this._indicator = new SensorsIndicator(this.metadata.name);
    Main.panel.addToStatusArea(this.uuid, this._indicator);

    this._start(this._cancellable).catch((e) => {
      if (!isCancelled(e)) logError(e, "sysfs-sensors: sensor lookup failed");
    });
  }

  async _start(cancellable) {
    const sensors = await findSensors(cancellable);
    if (!sensors.cpu && !sensors.fan) return;

    this._sensors = sensors;
    this._refresh();
    this._restartTimer();
  }

  _restartTimer() {
    if (!this._sensors) return;
    if (this._timerId) GLib.Source.remove(this._timerId);

    this._timerId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      this._settings.get_uint(INTERVAL_KEY),
      () => {
        this._refresh();
        return GLib.SOURCE_CONTINUE;
      },
    );
  }

  // Skip the tick while a slow read is still pending.
  _refresh() {
    if (!this._sensors || this._updating) return;
    this._updating = true;
    this._update(this._cancellable)
      .catch((e) => {
        if (!isCancelled(e)) logError(e, "sysfs-sensors: update failed");
      })
      .finally(() => {
        this._updating = false;
      });
  }

  async _update(cancellable) {
    const showFan = this._settings.get_boolean("show-fan");
    const cpu = await readInteger(this._sensors.cpu, cancellable);
    const fan = showFan
      ? await readInteger(this._sensors.fan, cancellable)
      : null;

    const parts = [];
    let level = LEVEL_NONE;
    if (cpu !== null) {
      const celsius = cpu / MILLIDEGREES_PER_DEGREE;
      const unit = this._settings.get_string("temperature-unit");
      parts.push(TEMPERATURE_FORMATTERS[unit](celsius));

      // Thresholds apply to the rounded value the panel shows.
      const shown = Math.round(celsius);
      if (shown >= this._settings.get_uint("hot-threshold")) level = LEVEL_HOT;
      else if (shown >= this._settings.get_uint("warm-threshold"))
        level = LEVEL_WARM;
    }
    if (fan !== null) parts.push(`${fan} RPM`);

    this._indicator.setText(parts.join(PARTS_SEPARATOR), level);
  }

  disable() {
    this._cancellable.cancel();
    this._cancellable = null;

    if (this._timerId) {
      GLib.Source.remove(this._timerId);
      this._timerId = 0;
    }

    this._settings.disconnectObject(this);
    this._settings = null;

    this._indicator.destroy();
    this._indicator = null;
    this._sensors = null;
  }
}
