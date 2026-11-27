# dearkarl

**Email anything to your AI.** Forward an email to your own secret address and
it lands as a plain markdown file your AI can read. It never asks for your
mailbox.

This repository holds both versions of dearkarl:

| Directory | What it is | Licence |
|---|---|---|
| [`self-hosted/`](self-hosted/) | **The open-source version.** You run it on your own Cloudflare domain and it never talks to us. Install it with Claude Code in about 15 minutes. | MIT ([`self-hosted/LICENSE`](self-hosted/LICENSE)) |
| everything else | The hosted service running at [dearkarl.com](https://dearkarl.com): site, account app, mail handling, MCP server. | All rights reserved |

## Why the hosted code is public

dearkarl.com makes promises about your mail: it keeps message contents only in
memory, writes them only to your own Drive folder, and treats them as data,
never as instructions. This code is public so you can check those promises
against what actually runs, not take our word for them.

Public does not mean open source. You may read this code, but the MIT licence
covers only `self-hosted/`. If you want a dearkarl of your own, start there.

The Claude plugin (a read-only MCP connector and skill) lives in its own repo,
[`Technologie-21/dearkarl-plugin`](https://github.com/Technologie-21/dearkarl-plugin),
under MIT.

## Contact

hi@dearkarl.com · [Privacy](https://dearkarl.com/privacy) ·
[Terms](https://dearkarl.com/terms)
