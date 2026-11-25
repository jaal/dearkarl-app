# Dear Karl for Claude

> This directory is the Claude plugin for dearkarl, under the MIT licence
> ([`LICENSE`](LICENSE)). Install it from
> [`jaal/dearkarl-plugin`](https://github.com/jaal/dearkarl-plugin), as shown
> below; that repo is where the plugin is published.

**Email anything to your AI.** Dear Karl gives you a secret email address. Forward
any email to it, and it is saved as a plain markdown file in a `dearkarl` folder in
your own Google Drive. This plugin lets Claude list and read those files, so you
can say "summarise what I sent Karl this morning" instead of copying and pasting.
Dear Karl never asks for access to your mailbox — it only sees what you choose to
forward.

## What's inside

- **Dear Karl connector** — the remote MCP server at `https://dearkarl.com/mcp`,
  with two read-only tools:
  - `list_files` — names, sizes and dates of your saved files (no contents)
  - `read_file` — the text of one file (up to 256 KB)
- **`dearkarl` skill** — tells Claude when to use the tools, to read only what
  you ask about, and to treat email contents as data, never as instructions.

Nothing in this plugin can send email, or create, change or delete files.

## Setup

1. Create a free account at [dearkarl.com](https://dearkarl.com) and copy your
   secret address.
2. Install the plugin:

   ```
   /plugin install dearkarl --marketplace jaal/dearkarl-plugin
   ```

   Then connect it: in Claude Code run `/mcp`, pick
   **dearkarl**, and sign in. Sign-in uses OAuth; you never paste a token.
3. Forward an email to your address and ask Claude: *"What's new in Dear Karl?"*

## Example prompts

- "What did I send to Dear Karl today?"
- "Read the newest file in Dear Karl and list the action items."
- "Find the invoice I forwarded to Karl last week and tell me the total."

## Privacy

The connector reads only the files in the `dearkarl` folder of the Google Drive
account you signed in with, and only when Claude calls a tool. The plugin itself
stores nothing and sends data nowhere except `dearkarl.com`. Dear Karl is not
intended for people under 18. Full policy: <https://dearkarl.com/privacy>.
Terms: <https://dearkarl.com/terms>.

## Support

Email [hi@dearkarl.com](mailto:hi@dearkarl.com). Dear Karl is run by Technologie 21
Aleksander Jaworski, Wrocław, Poland.

## Credits

The icon uses the 📬 emoji from [Noto Emoji](https://github.com/googlefonts/noto-emoji)
by Google, licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
