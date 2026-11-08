# 0001 - Read sysfs directly with asynchronous GIO, never spawn processes

Status: Accepted

## Context

The author used Freon for temperatures. A trace of the `gnome-shell` main
thread (`offcputime`, 10 minutes) showed 6.8 s blocked in
`g_spawn_command_line_sync`: with a 5 s refresh Freon ran `cat` four times for
the battery and `nvme smart-log` once, synchronously, plus an asynchronous
`sensors`. Each call forks the shell and stalls input and rendering until the
child exits; libinput logged `event processing lagging behind by 21-32 ms`.

Every value needed here is already exported by the kernel as a small sysfs
file under `/sys/class/hwmon`.

## Decision

Read sysfs files directly with `Gio.File.load_contents_async` and enumerate
directories with `enumerate_children_async` / `next_files_async`, promisified
via `Gio._promisify`. No `GLib.spawn_*`, no `Gio.Subprocess`, no synchronous
file reads.

## Consequences

- The main loop never waits on a child process or on file I/O.
- Only sensors exported through hwmon are available; SMART data that needs
  `smartctl` or root is out of scope.
