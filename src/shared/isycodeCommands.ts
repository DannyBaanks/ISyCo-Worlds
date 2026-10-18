/**
 * Command reference for the ISyCode terminal agent (DannyBaanks/ISyCode).
 *
 * Kept in the same shape as the Claude/Codex/Grok references so the Command
 * Center and the generated hive command guide can render provider-native
 * commands.
 *
 * Transcribed from the SHIPPED SOURCE, not from web docs, because the source
 * cannot lag the installed CLI:
 *   - slash commands → `src/isycode/tui_app_menu.py::_register_builtin_plugins`
 *     (the `Plugin(name="isycode", …)` command table; each `PluginCommand`'s
 *     second argument is the description string the TUI's own `/help` prints).
 *   - CLI subcommands → `src/isycode/launcher.py::USAGE`, the dispatcher's own
 *     usage text.
 *
 * ISyCode is a Textual TUI: its slash commands are typed into the composer, and
 * its CLI subcommands are separate `isycode <verb>` invocations that run and
 * exit. `kind` marks that split exactly as the other catalogs do.
 */
import type { CmdGroup } from './claudeCommands';

export const ISYCODE_COMMAND_GROUPS: CmdGroup[] = [
  {
    title: 'SESSION',
    items: [
      { cmd: '/sessions', kind: 'slash', desc: 'List, start, resume, search, rename, fork, export or import conversations.', usage: '/sessions new' },
      { cmd: '/compact', kind: 'slash', desc: 'Summarize earlier messages to free up context. The saved conversation keeps the full transcript.', usage: '/compact keep the security decisions' },
      { cmd: '/session', kind: 'slash', desc: 'Show the current workspace, provider and chat role.' },
      { cmd: '/resume', kind: 'slash', desc: 'Resume an interrupted turn without repeating the tools that already completed.' },
      { cmd: '/retry', kind: 'slash', desc: 'Prepare an interrupted prompt for review; never auto-replays tools.' },
      { cmd: '/msg', kind: 'slash', desc: 'Send your words to another conversation; it answers them as your message.' },
      { cmd: 'isycode sessions', kind: 'cli', desc: 'List / show / search / rename / delete local conversations. Add --json for machine-readable output.' },
      { cmd: 'isycode stats', kind: 'cli', desc: 'Aggregate the locally recorded session usage. Add --json.' }
    ]
  },
  {
    title: 'PROVIDERS & MODELS',
    items: [
      { cmd: '/providers', kind: 'slash', desc: 'Open the provider selector (OpenAI, Anthropic, NVIDIA NIM, OpenRouter, Ollama, llama.cpp).' },
      { cmd: '/models', kind: 'slash', desc: 'Models available for the current provider.' },
      { cmd: '/keys', kind: 'slash', desc: 'Show credential status grouped by setup state. Values stay in the OS keyring.' },
      { cmd: '/check', kind: 'slash', desc: 'Test the selected provider with one owned request (uses API quota).' },
      { cmd: '/usage', kind: 'slash', desc: 'Show the provider-reported chat token usage.' },
      { cmd: 'isycode models', kind: 'cli', desc: 'Show local provider/model metadata; no network calls. Add --json.' }
    ]
  },
  {
    title: 'WORKSPACE & GIT',
    items: [
      { cmd: '/git', kind: 'slash', desc: 'Show the git branch and the changed files.' },
      { cmd: '/diff', kind: 'slash', desc: 'Show the git diff.', usage: '/diff <path> --staged' },
      { cmd: '/commit', kind: 'slash', desc: 'Commit changed files after reviewing the diff.' },
      { cmd: '/undo', kind: 'slash', desc: "Undo ISyCode's last file change (shows the diff first)." },
      { cmd: '/run', kind: 'slash', desc: 'Run one command in the workspace sandbox (asks first).' },
      { cmd: '/readme', kind: 'slash', desc: 'Choose and preview a workspace README.md.' },
      { cmd: '/context', kind: 'slash', desc: 'Read the workspace AGENTS.md with permission, or clear it.' }
    ]
  },
  {
    title: 'EXTENSIONS',
    items: [
      { cmd: '/mcp', kind: 'slash', desc: 'Local MCP servers.', usage: '/mcp add <preset> | list | start <name> | stop <name>' },
      { cmd: '/skills', kind: 'slash', desc: 'Bundled workflow guidance.', usage: '/skills list | use <name> | clear' },
      { cmd: '/harness', kind: 'slash', desc: 'Open the read-only Multi Harness settings map.' },
      { cmd: '/subagent', kind: 'slash', desc: 'Delegate a task; choose a recent model before launch.' },
      { cmd: '/iteration', kind: 'slash', desc: 'Sequential iteration with three chosen models.', usage: '/iteration retry <id>' },
      { cmd: '/plan', kind: 'slash', desc: 'Plan an intent via IsyMotron.' },
      { cmd: '/review', kind: 'slash', desc: 'Ask for one explicit external review.' },
      { cmd: '/idea', kind: 'slash', desc: 'Expand the current idea note.' },
      { cmd: '/rtk', kind: 'slash', desc: 'Native RTK settings.', usage: '/rtk recall <sha256>' }
    ]
  },
  {
    title: 'CLI',
    items: [
      { cmd: 'isycode', kind: 'cli', desc: 'Start the chat TUI in the current directory (`isycode tui` is the explicit spelling).' },
      { cmd: 'isycode -p "<prompt>"', kind: 'cli', desc: 'Answer once and exit (stdin when the prompt is omitted or -). Only granted read-only tools run; nothing asks for approval. Add --json.' },
      { cmd: 'isycode cli', kind: 'cli', desc: 'Browse actions by semantic category. It does not run arbitrary shell commands.' },
      { cmd: 'isycode doctor', kind: 'cli', desc: 'Inspect local dependencies and configuration; no network calls. Add --json.' },
      { cmd: 'isycode dirs', kind: 'cli', desc: 'Show config/state locations and precedence, never values. Add --json.' },
      { cmd: 'isycode update', kind: 'cli', desc: 'Update this ISyCode installation (alias: `isycode actualizar`). --check only queries; --yes pre-approves the stash/merge.' },
      { cmd: 'isycode completion <shell>', kind: 'cli', desc: 'Print bash, zsh or fish completion.' },
      { cmd: 'isycode --version', kind: 'cli', desc: 'Show the installed version.' }
    ]
  }
];
