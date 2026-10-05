package com.cerespacifica.walkthrough

/**
 * Turns what the inspector said into a universal-mode command.
 *
 * Commands only match when they are the whole phrase, so "next" moves to the next
 * field but "next to the sink" is typed as dictation. Saying "type ..." forces
 * dictation, e.g. "type next" types the word "next".
 */
sealed class Command {
    object NextField : Command()
    object PreviousField : Command()
    object Enter : Command()
    object NewLine : Command()
    object UndoLast : Command()
    object ClearField : Command()
    object WhereAmI : Command()
    object Photo : Command()
    object Stop : Command()
    object Empty : Command()
    object Confirm : Command()
    object ScrollDown : Command()
    object ScrollUp : Command()
    object BackScreen : Command()
    object ReadScreen : Command()
    data class PickOption(val n: Int) : Command()
    /** forceType: "type ..." or "comment ..." always types, never taps. */
    data class Dictate(val text: String, val forceType: Boolean = false) : Command()

    fun name(): String = this::class.simpleName ?: "Command"
}

object CommandParser {
    private val phrases: Map<String, Command> = buildMap {
        listOf("next", "next field", "tab", "go next", "forward", "move on").forEach { put(it, Command.NextField) }
        listOf("previous", "previous field", "go back", "back", "last field").forEach { put(it, Command.PreviousField) }
        listOf("enter", "select", "done", "okay enter", "press enter").forEach { put(it, Command.Enter) }
        listOf("new line", "next line").forEach { put(it, Command.NewLine) }
        listOf("undo", "scratch that", "delete that", "undo that").forEach { put(it, Command.UndoLast) }
        listOf("clear", "clear field", "clear it", "erase field").forEach { put(it, Command.ClearField) }
        listOf("where am i", "what field", "which field", "repeat", "say again").forEach { put(it, Command.WhereAmI) }
        listOf("photo", "take photo", "take a photo", "picture", "take picture", "take a picture").forEach { put(it, Command.Photo) }
        listOf("stop", "cancel", "never mind", "nevermind", "no", "no thanks").forEach { put(it, Command.Stop) }
        listOf("yes", "yes tap it", "tap it", "do it", "confirm", "go ahead", "yep").forEach { put(it, Command.Confirm) }
        listOf("scroll down", "scroll", "page down", "more").forEach { put(it, Command.ScrollDown) }
        listOf("scroll up", "page up").forEach { put(it, Command.ScrollUp) }
        listOf("back screen", "previous screen", "go back a screen").forEach { put(it, Command.BackScreen) }
        listOf("read screen", "read the screen", "what's on screen", "what's on the screen", "options", "read options").forEach { put(it, Command.ReadScreen) }
    }

    fun normalize(s: String): String =
        s.lowercase().replace(Regex("[^a-z0-9' ]"), " ").replace(Regex("\\s+"), " ").trim()

    fun parse(raw: String): Command {
        val trimmed = raw.trim()
        val t = normalize(trimmed)
        if (t.isEmpty()) return Command.Empty
        val forced = listOf("type ", "comment ", "note ").firstOrNull { t.startsWith(it) && t.length > it.length }
        if (forced != null) {
            val rest = trimmed.substring(trimmed.indexOf(' ') + 1).trim()
            return Command.Dictate(clean(rest), forceType = true)
        }
        Regex("^(?:number|option) (\\d|one|two|three|four|five|six)$").find(t)?.let { m ->
            val w = mapOf("one" to 1, "two" to 2, "three" to 3, "four" to 4, "five" to 5, "six" to 6)
            return Command.PickOption(w[m.groupValues[1]] ?: m.groupValues[1].toInt())
        }
        phrases[t]?.let { return it }
        return Command.Dictate(clean(trimmed))
    }

    private fun clean(s: String): String = s.replace(Regex("\\s+"), " ").trim()
}
