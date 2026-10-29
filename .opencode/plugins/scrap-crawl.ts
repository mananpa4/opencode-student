import { Plugin } from "@opencode/plugin"

// OpenCode Student ↔ Scrap-Crawl bridge.
//
// Scrap-Crawl (aio-scrap-crawl) exposes a CLI (`node apps/cli/dist/index.js`) and a
// planned REST API. This plugin registers a `scrap_crawl` tool that shells out to the
// CLI, so the agent can scrape/crawl a URL through the platform.
//
// Configuration (environment):
//   SCRAP_CRAWL_HOME  - path to the aio-scrap-crawl checkout
//                       (default: F:\Usuarios\Tony\OneDrive\Documents\GitHub\Scrap-Crawl\aio-scrap-crawl)
//   SCRAP_CRAWL_BIN   - interpreter (default: node)
//
// The tool degrades gracefully: if the checkout or CLI is missing, it returns a clear
// message instead of throwing.

const DEFAULT_HOME = "F:\\Usuarios\\Tony\\OneDrive\\Documents\\GitHub\\Scrap-Crawl\\aio-scrap-crawl"

function scrapCrawlHome() {
  return process.env.SCRAP_CRAWL_HOME ?? DEFAULT_HOME
}

function cliEntry() {
  return `${scrapCrawlHome()}/apps/cli/dist/index.js`
}

async function run(args: string[]) {
  const bin = process.env.SCRAP_CRAWL_BIN ?? "node"
  const proc = Bun.spawn({ cmd: [bin, ...args], stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
  const code = await proc.exited

  return { code, stdout, stderr }
}

export default Plugin.define({
  id: "opencode.student.scrap-crawl",
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      if (editor.get("scrap_crawl")) return
      editor.add({
        name: "scrap_crawl",
        description:
          "Scrape or crawl a URL through the Scrap-Crawl platform (aio-scrap-crawl). Use for structured web data extraction, crawling a site, or bypassing anti-bot protection.",
        input: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to scrape or crawl" },
            mode: {
              type: "string",
              enum: ["scrape", "crawl"],
              description: "scrape a single page (default) or crawl a site",
            },
          },
          required: ["url"],
        },
        async execute(input) {
          const { url, mode } = input as { url: string; mode?: "scrape" | "crawl" }

          if (!url) return { content: "scrap_crawl: a URL is required" }

          const result = await run([cliEntry(), mode ?? "scrape", url])

          if (result.code !== 0) {
            return {
              content: `Scrap-Crawl ${mode ?? "scrape"} failed (exit ${result.code}).\n${result.stderr || result.stdout}`.trim(),
            }
          }

          return { content: result.stdout || `Scrap-Crawl ${mode ?? "scrape"} finished with no output.` }
        },
      })
    })
  },
})
