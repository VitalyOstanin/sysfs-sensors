# 0008 - Show the CPU temperature averaged over the update interval

Status: Accepted

## Context

The CPU package input follows turbo bursts: on the author's laptop it moves
between 86 and 101 °C within a second under light load. With one read every
`update-interval` seconds the panel jumped between about 80 and 100 °C,
depending on which phase of a burst the read hit. That does not answer "is the
laptop getting hot?" (ADR 0002).

## Decision

The package input is read once a second; the panel shows the mean of the last
`update-interval` samples and is redrawn every `update-interval` seconds. The
heat thresholds (ADR 0006) are compared with that mean. The fan speed is still
read once per redraw. A failed read clears the samples, so a sensor that stops
answering disappears from the panel instead of showing a stale mean.

## Consequences

- One small sysfs read per second instead of one per interval; the reads stay
  asynchronous (ADR 0001) and a tick is skipped while the previous one is
  pending.
- Short peaks no longer reach the panel; sustained heat still does.
