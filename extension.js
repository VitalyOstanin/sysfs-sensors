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

// hwmon chip name -> label of its whole-package temperature input.
const CPU_PACKAGE_LABELS = {
  coretemp: "Package id 0",
  k10temp: "Tctl",
};

function isCancelled(e) {
  return e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED);
}

async function readText(path, cancellable) {
  const [bytes] =
    await Gio.File.new_for_path(path).load_contents_async(cancellable);
  return new TextDecoder().decode(bytes).trim();
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
      100,
      GLib.PRIORITY_DEFAULT,
      cancellable,
    );
    if (infos.length === 0) break;
    for (const info of infos) names.push(info.get_name());
  }
  return names;
}

// hwmon numbering changes between boots, so sensors are looked up by chip
// name and label on every enable(). A fan is taken only if its input can be
// read: some acpi_fan devices expose fan1_input that fails with ENODEV.
async function findSensors(cancellable) {
  let cpu = null;
  let fan = null;

  for (const chip of await listDir(HWMON_DIR, cancellable)) {
    const dir = `${HWMON_DIR}/${chip}`;
    const files = await listDir(dir, cancellable);
    const name = await readText(`${dir}/name`, cancellable);

    if (!cpu && Object.hasOwn(CPU_PACKAGE_LABELS, name)) {
      for (const file of files.filter((f) => /^temp\d+_label$/.test(f))) {
        const label = await readText(`${dir}/${file}`, cancellable);
        if (label === CPU_PACKAGE_LABELS[name]) {
          cpu = `${dir}/${file.replace("_label", "_input")}`;
          break;
        }
      }
    }

    if (!fan) {
      for (const file of files.filter((f) => /^fan\d+_input$/.test(f))) {
        try {
          await readText(`${dir}/${file}`, cancellable);
          fan = `${dir}/${file}`;
          break;
        } catch (e) {
          if (isCancelled(e)) throw e;
        }
      }
    }
  }

  return { cpu, fan };
}

const SensorsIndicator = GObject.registerClass(
  class SensorsIndicator extends PanelMenu.Button {
    _init(name) {
      super._init(0.5, name, true);
      this._label = new St.Label({
        text: "",
        y_align: Clutter.ActorAlign.CENTER,
      });
      this.add_child(this._label);
      this.hide();
    }

    // level: "" | "warm" | "hot"
    setText(text, level) {
      this._label.text = text;
      this._label.style_class = level ? `sysfs-sensors-${level}` : "";
      this.visible = text !== "";
    }
  },
);

function formatTemperature(celsius, unit) {
  if (unit === "fahrenheit") return `${Math.round((celsius * 9) / 5 + 32)}°F`;
  return `${Math.round(celsius)}°C`;
}

export default class SysfsSensors extends Extension {
  enable() {
    this._cancellable = new Gio.Cancellable();
    this._timerId = 0;
    this._sensors = null;

    this._settings = this.getSettings();
    this._settings.connectObject(
      "changed::update-interval",
      () => this._restartTimer(),
      "changed",
      (_settings, key) => {
        if (key !== "update-interval") this._refresh();
      },
      this,
    );

    this._indicator = new SensorsIndicator(this.metadata.name);
    Main.panel.addToStatusArea(this.uuid, this._indicator, 0, "right");

    this._start(this._cancellable).catch((e) => {
      if (!isCancelled(e)) logError(e, "sysfs-sensors: sensor lookup failed");
    });
  }

  async _start(cancellable) {
    const sensors = await findSensors(cancellable);
    if (!sensors.cpu && !sensors.fan) return;

    this._sensors = sensors;
    await this._update(cancellable);
    this._restartTimer();
  }

  _restartTimer() {
    if (!this._sensors) return;
    if (this._timerId) GLib.Source.remove(this._timerId);

    this._timerId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      this._settings.get_uint("update-interval"),
      () => {
        this._refresh();
        return GLib.SOURCE_CONTINUE;
      },
    );
  }

  _refresh() {
    if (!this._sensors) return;
    this._update(this._cancellable).catch((e) => {
      if (!isCancelled(e)) logError(e, "sysfs-sensors: update failed");
    });
  }

  async _readOptional(path, cancellable) {
    if (!path) return null;
    try {
      return await readText(path, cancellable);
    } catch (e) {
      if (isCancelled(e)) throw e;
      return null;
    }
  }

  async _update(cancellable) {
    const showFan = this._settings.get_boolean("show-fan");
    const cpu = await this._readOptional(this._sensors.cpu, cancellable);
    const fan = showFan
      ? await this._readOptional(this._sensors.fan, cancellable)
      : null;

    const parts = [];
    let level = "";
    if (cpu !== null) {
      const celsius = Number(cpu) / 1000;
      parts.push(
        formatTemperature(celsius, this._settings.get_string("temperature-unit")),
      );
      if (celsius >= this._settings.get_uint("hot-threshold")) level = "hot";
      else if (celsius >= this._settings.get_uint("warm-threshold"))
        level = "warm";
    }
    if (fan !== null) parts.push(`${fan} RPM`);

    this._indicator.setText(parts.join("  "), level);
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
