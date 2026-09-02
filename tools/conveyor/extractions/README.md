# Preserved extraction JSON

This directory is the tracked copy of every extraction the campaign has produced, written
by:

```sh
tools/conveyor/conveyor --data-dir <conveyor data dir> export-extractions --to tools/conveyor/extractions
```

It exists because extraction JSON is the only campaign output that cannot be recreated
cheaply. Datasheets refetch from their recorded URLs and packages regenerate from the
extraction, but the LLM reading of each PDF costs the tokens again. Everything else in
`tools/conveyor/data/` is prunable; this is not.

`manifest.json` records the source data directory, the export time, and the SHA-256 and
byte size of every file. Paths mirror their layout under the source data directory, so two
tranches cannot collide on a file name. Re-running the export is idempotent: only files
whose content hash changed are copied.

Do not hand-edit these files. They are evidence: `conveyor ingest` rewrote each one with
its deterministic SI normalization applied, and a promoted model cites the result.
