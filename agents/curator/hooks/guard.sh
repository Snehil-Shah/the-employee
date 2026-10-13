#!/bin/sh
# Runs with cwd = this agent's directory; the guard reads hooks/allowed-tools.
exec node "$(git rev-parse --show-toplevel)/lib/guard.mjs"
