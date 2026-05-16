import { render } from "ink";
import { openCli, reconcile } from "../context.js";
import { App } from "./app.js";

export async function runTui(): Promise<void> {
  if (!process.stdout.isTTY) {
    console.error("TUI requires an interactive terminal.");
    process.exitCode = 1;
    return;
  }
  const ctx = openCli();
  try {
    await reconcile(ctx, { notes: true, code: true, entities: true, verify: true });
    const { waitUntilExit } = render(<App ctx={ctx} />);
    await waitUntilExit();
  } finally {
    ctx.db.close();
  }
}
