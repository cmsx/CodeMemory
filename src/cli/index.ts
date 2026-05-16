#!/usr/bin/env node
import { buildProgram } from "./program.js";

buildProgram()
  .parseAsync(process.argv)
  .catch((e: unknown) => {
    // CommanderError from .exitOverride() (--help, parse errors) — use its exitCode
    if (e && typeof e === "object" && "code" in e && String((e as { code: unknown }).code).startsWith("commander.")) {
      process.exitCode = (e as { exitCode?: number }).exitCode ?? 0;
      return;
    }
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  });
