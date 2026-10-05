package com.cerespacifica.walkthrough

import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** What the keyboard knows about the text field the inspector is in. */
data class FieldInfo(
    val pkg: String,
    val label: String,
    val kind: String,
    val fieldId: Int,
    val labeled: Boolean,
) {
    val key: String get() = "$pkg:$fieldId:$label"

    fun spoken(): String = if (labeled) "$label field" else "Unlabeled $kind field"

    companion object {
        // Mirrors android.text.InputType so this file stays testable without a phone.
        private const val CLASS_MASK = 0x0000000f
        private const val CLASS_TEXT = 1
        private const val CLASS_NUMBER = 2
        private const val CLASS_PHONE = 3
        private const val CLASS_DATETIME = 4
        private const val FLAG_MULTI_LINE = 0x00020000

        fun kindOf(inputType: Int): String = when (inputType and CLASS_MASK) {
            CLASS_NUMBER -> "number"
            CLASS_PHONE -> "phone"
            CLASS_DATETIME -> "date"
            CLASS_TEXT -> if (inputType and FLAG_MULTI_LINE != 0) "notes" else "text"
            else -> "text"
        }

        fun build(pkg: String?, hint: CharSequence?, label: CharSequence?, fieldName: String?,
                  inputType: Int, fieldId: Int): FieldInfo {
            val name = listOf(hint?.toString(), label?.toString(), fieldName)
                .firstOrNull { !it.isNullOrBlank() }?.trim()
            return FieldInfo(pkg ?: "unknown", name ?: "unlabeled", kindOf(inputType), fieldId, name != null)
        }
    }
}

data class LogEntry(val time: Long, val kind: String, val pkg: String, val field: String, val message: String) {
    fun line(): String {
        val ts = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date(time))
        return "$ts  $kind  [$pkg] ${if (field.isNotEmpty()) "<$field> " else ""}$message".trim()
    }
}

/**
 * Records what universal mode could and couldn't do in each app, so a field test
 * produces a report: which fields had labels, whether dictation went in, and
 * whether "next" actually moved between fields.
 */
object DiagnosticsLog {
    const val FIELD = "FIELD"
    const val HEARD = "HEARD"
    const val DICTATE_OK = "DICTATE_OK"
    const val DICTATE_FAIL = "DICTATE_FAIL"
    const val NAV_OK = "NAV_OK"
    const val NAV_NO_MOVE = "NAV_NO_MOVE"
    const val NO_FIELD = "NO_FIELD"
    const val PHOTO_OK = "PHOTO_OK"
    const val PHOTO_CANCEL = "PHOTO_CANCEL"
    const val BUTTON = "BUTTON"
    const val MIC = "MIC"
    const val ERROR = "ERROR"
    const val SCREEN = "SCREEN"
    const val SCREEN_POINT = "SCREEN_POINT"
    const val SCREEN_TAP = "SCREEN_TAP"
    const val SCREEN_NOMATCH = "SCREEN_NOMATCH"
    const val SCREEN_BLOCKED = "SCREEN_BLOCKED"

    private val entries = mutableListOf<LogEntry>()
    private val listeners = mutableListOf<() -> Unit>()
    var file: File? = null
    var clock: () -> Long = { System.currentTimeMillis() }

    @Synchronized
    fun add(kind: String, pkg: String = "", field: String = "", message: String = "") {
        val e = LogEntry(clock(), kind, pkg, field, message)
        entries.add(e)
        if (entries.size > 2000) entries.removeAt(0)
        try { file?.appendText(e.line() + "\n") } catch (_: Exception) { }
        listeners.toList().forEach { it() }
    }

    @Synchronized fun snapshot(): List<LogEntry> = entries.toList()

    @Synchronized fun clear() {
        entries.clear()
        try { file?.writeText("") } catch (_: Exception) { }
        listeners.toList().forEach { it() }
    }

    fun addListener(l: () -> Unit) { synchronized(this) { listeners.add(l) } }
    fun removeListener(l: () -> Unit) { synchronized(this) { listeners.remove(l) } }

    /** Per-app scorecard: the answer to "does universal mode work with this app?" */
    @Synchronized
    fun summary(ownPackage: String = ""): String {
        val byApp = entries.filter { it.pkg.isNotEmpty() && it.pkg != ownPackage }.groupBy { it.pkg }
        if (byApp.isEmpty()) return "No other apps tested yet. Open your inspection app, tap a text field, and try dictating."
        return byApp.entries.joinToString("\n\n") { (pkg, es) ->
            val fields = es.filter { it.kind == FIELD }
            val distinct = fields.map { it.field + "|" + it.message }.distinct()
            val labeled = fields.filter { it.field != "unlabeled" }.map { it.field }.distinct()
            fun n(k: String) = es.count { it.kind == k }
            val navTotal = n(NAV_OK) + n(NAV_NO_MOVE)
            val verdict = when {
                n(DICTATE_OK) == 0 && n(DICTATE_FAIL) == 0 && n(SCREEN_TAP) + n(SCREEN_POINT) + n(SCREEN_NOMATCH) == 0 -> "Not enough data yet"
                n(SCREEN_TAP) + n(SCREEN_POINT) > 0 && n(SCREEN_NOMATCH) > n(SCREEN_TAP) + n(SCREEN_POINT) -> "Screen Pilot mostly couldn't find items; this app may need a profile"
                n(DICTATE_FAIL) > n(DICTATE_OK) -> "Dictation mostly failed"
                navTotal > 0 && n(NAV_OK) * 2 < navTotal -> "Dictation works; field-to-field moves mostly don't"
                else -> "Universal mode works here"
            }
            buildString {
                appendLine(pkg)
                appendLine("  Verdict: $verdict")
                appendLine("  Text fields seen: ${distinct.size} (${labeled.size} with labels)")
                appendLine("  Dictation: ${n(DICTATE_OK)} typed, ${n(DICTATE_FAIL)} failed")
                appendLine("  Next/previous: ${n(NAV_OK)} moved, ${n(NAV_NO_MOVE)} stayed put")
                appendLine("  Photos: ${n(PHOTO_OK)} saved, ${n(PHOTO_CANCEL)} cancelled")
                append("  Screen Pilot: ${n(SCREEN_TAP)} tapped, ${n(SCREEN_POINT)} pointed out, ${n(SCREEN_NOMATCH)} not found, ${n(SCREEN_BLOCKED)} save/submit refused")
            }
        }
    }

    @Synchronized
    fun report(ownPackage: String = ""): String =
        "WALKTHROUGH BRIDGE FIELD TEST\n\n" + summary(ownPackage) + "\n\nFULL LOG\n" +
            entries.joinToString("\n") { it.line() }
}
