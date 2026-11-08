# 0002 - Show only the CPU package temperature and the fan speed

Status: Accepted (the "no settings" part superseded by 0006)

## Context

The question the indicator answers is "is the laptop getting hot?". Freon showed
the average and the maximum over all sensors. On the author's laptop that mixes
27 °C (`acpitz`), 57 °C (Wi-Fi), 49 °C (NVMe) and 64-68 °C (CPU cores): the
average answers nothing and the maximum is almost always the CPU package.

## Decision

Show two numbers:

- the CPU package temperature: `coretemp` input labelled `Package id 0`
  (Intel) or `k10temp` input labelled `Tctl` (AMD);
- the first readable `fan*_input` of any hwmon chip, in RPM.

No menu and no settings. A missing sensor is omitted; with neither found the
indicator is hidden.

## Consequences

- The panel shows how hot the CPU is and how hard the laptop is cooling it.
- Disk, Wi-Fi and per-core temperatures are not shown; adding them would need
  a new ADR.
- Other CPU drivers (for example `zenpower`) need an entry in
  `CPU_PACKAGE_LABELS`.
