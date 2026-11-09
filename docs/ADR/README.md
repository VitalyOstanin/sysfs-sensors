# Architecture Decision Records

This directory records the technical decisions made for the `sysfs-sensors`
extension, using a lightweight ADR format (Context / Decision / Consequences).

## Index

| ID                                          | Title                                                           | Status   |
| ------------------------------------------- | --------------------------------------------------------------- | -------- |
| [0001](0001-read-sysfs-asynchronously.md)   | Read sysfs directly with asynchronous GIO, never spawn processes | Accepted |
| [0002](0002-show-cpu-package-and-fan.md)    | Show only the CPU package temperature and the fan speed          | Accepted, settings part superseded by 0006, menu part by 0007 |
| [0003](0003-uuid-namespace.md)              | Use `@VitalyOstanin` as the uuid namespace                       | Accepted |
| [0004](0004-resource-cleanup-on-disable.md) | Cancel pending I/O and release all resources on disable          | Accepted |
| [0005](0005-support-gnome-45-to-51.md)      | Declare and verify support for GNOME 45-51                       | Accepted |
| [0006](0006-settings.md)                    | Add a small set of settings                                      | Accepted |
| [0007](0007-settings-menu.md)               | Open the preferences from a panel menu                           | Accepted |
| [0008](0008-average-cpu-temperature.md)      | Show the CPU temperature averaged over the update interval       | Accepted |
