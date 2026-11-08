# 0004 - Cancel pending I/O and release all resources on disable

Status: Accepted

## Context

GNOME Shell enables and disables extensions repeatedly, for example on every
screen lock. Asynchronous reads may still be in flight when `disable()` runs.

## Decision

- One `Gio.Cancellable` per `enable()`; every read receives it, and `disable()`
  cancels it. Cancelled operations reject with `G_IO_ERROR_CANCELLED`, which is
  not logged.
- The refresh timer id is kept and removed in `disable()`.
- The panel button (with the label it owns) is destroyed in `disable()`.

## Consequences

- No timer, read or actor survives `disable()`.
- A read cannot touch a destroyed indicator: a cancelled read rejects before its
  continuation updates the indicator.
