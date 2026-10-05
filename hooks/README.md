# Hooks layer

Events enforce rules; prompts only request them. Map every rule you care about to
the event where it can be *blocked*, then pick the cheapest enforcement rung:

1. **regex/script** — deterministic checks (secrets, paths, force-push). Free, instant.
2. **Jev** — fuzzy policy calls (schedule sanity, scoping) at ~$0.000017 each.
3. **LLM judge** — last resort for ambiguous judgment. Sample 10%, not 100%.

If the agent "ignores the rules," the diagnostic order is: wrong event → wrong
rung → bad regex → missing fail-closed default → only then a judge problem.
Full recipes live in the `enforce-with-hooks` skill (skills/enforce-with-hooks).
