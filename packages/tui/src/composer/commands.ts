export type SlashCommand = {
  name: string
  description: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: "/help", description: "show commands" },
  { name: "/clear", description: "new session" },
  { name: "/model", description: "change model" },
  { name: "/provider", description: "change provider" },
  { name: "/resume", description: "resume a session" },
  { name: "/mode", description: "cycle Plan/Confirm/Auto" },
  { name: "/status", description: "session status" },
  { name: "/exit", description: "quit" },
]

export const HELP_TEXT = SLASH_COMMANDS.map(
  (command) => `${command.name} — ${command.description}`,
).join("\n")

/**
 * A command menu is active only for a bare slash token. Arguments close it.
 */
export function matchSlashCommands(input: string, limit = 5): SlashCommand[] {
  if (!input.startsWith("/") || /\s/.test(input)) return []
  const query = input.split(/\s+/)[0] ?? "/"
  return SLASH_COMMANDS.filter((command) => command.name.startsWith(query)).slice(
    0,
    Math.max(1, limit),
  )
}
