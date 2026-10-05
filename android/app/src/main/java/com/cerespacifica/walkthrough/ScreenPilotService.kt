package com.cerespacifica.walkthrough

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Context
import android.graphics.Color
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.FrameLayout

/**
 * Screen Pilot: app-agnostic mode.
 *
 * Reads the buttons, checkboxes and fields of whatever app is open, finds the one
 * matching what the inspector said, and either points at it (default: highlight and
 * wait for "yes") or taps it (when "tap automatically" is on and the match is clear).
 * It never taps save, submit, sign or delete buttons, and it only acts while the
 * inspector is holding and looking at the phone. Nothing here works remotely.
 */
class ScreenPilotService : AccessibilityService() {

    companion object {
        @Volatile var instance: ScreenPilotService? = null
            private set
        private const val PREFS = "walkthrough"
        fun autoTap(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("auto_tap", false)
        fun logLabels(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("log_labels", false)
    }

    data class Outcome(val handled: Boolean, val say: String = "")

    private val main = Handler(Looper.getMainLooper())
    private var highlight: View? = null
    private var pending: ScreenTarget? = null
    private var options: List<ScreenTarget> = emptyList()
    private var lastTapped: Pair<String, Boolean>? = null // label, was a checkbox
    private var nodes: Map<Int, AccessibilityNodeInfo> = emptyMap()
    private val clearHighlight = Runnable { removeHighlight() }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        VoiceController.init(this)
        DiagnosticsLog.add(DiagnosticsLog.SCREEN, message = "Screen Pilot turned on")
    }

    override fun onDestroy() {
        removeHighlight()
        if (instance === this) instance = null
        super.onDestroy()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Screen changes make an old highlight wrong; drop it.
        if (event?.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && pending != null) {
            pending = null
            main.post(clearHighlight)
        }
    }

    override fun onInterrupt() {}

    // ---------------------------------------------------------------- reading the screen
    private fun currentPackage(): String = rootInActiveWindow?.packageName?.toString().orEmpty()

    private fun labelOf(n: AccessibilityNodeInfo): String {
        val own = listOf(n.text, n.contentDescription, n.hintText).firstOrNull { !it.isNullOrBlank() }?.toString()
        if (!own.isNullOrBlank()) return own.trim()
        // Clickable rows often keep their words in children.
        val parts = mutableListOf<String>()
        fun walk(c: AccessibilityNodeInfo?, depth: Int) {
            if (c == null || depth > 3 || parts.size >= 3) return
            val s = (c.text ?: c.contentDescription)?.toString()
            if (!s.isNullOrBlank()) parts.add(s.trim())
            for (i in 0 until c.childCount) walk(c.getChild(i), depth + 1)
        }
        for (i in 0 until n.childCount) walk(n.getChild(i), 1)
        if (parts.isNotEmpty()) return parts.joinToString(" ")
        return n.viewIdResourceName?.substringAfterLast('/')?.replace('_', ' ').orEmpty()
    }

    /** Every visible thing a finger could act on, with a readable label. */
    fun targets(): List<ScreenTarget> {
        val root = rootInActiveWindow ?: return emptyList()
        // Our own screens are off limits, except the practice inspection.
        if (root.packageName == packageName && !PracticeActivity.visible) return emptyList()
        val found = mutableListOf<Pair<ScreenTarget, AccessibilityNodeInfo>>()
        var id = 0
        fun walk(n: AccessibilityNodeInfo?) {
            if (n == null) return
            if (n.isVisibleToUser && n.isEnabled && (n.isClickable || n.isCheckable || n.isEditable)) {
                val label = labelOf(n)
                if (label.length in 2..240) {
                    val kind = when { n.isEditable -> "field"; n.isCheckable -> "checkbox"; else -> "button" }
                    found.add(ScreenTarget(id++, label, kind) to n)
                }
            }
            for (i in 0 until n.childCount) walk(n.getChild(i))
        }
        walk(root)
        nodes = found.associate { it.first.id to it.second }
        return found.map { it.first }
    }

    // ---------------------------------------------------------------- voice entry points
    /** A phrase that may name something on screen. Returns handled=false to let typing take it. */
    fun handlePhrase(said: String, fieldFocused: Boolean): Outcome {
        val list = targets().filter { it.kind != "field" }
        if (list.isEmpty()) return Outcome(false)
        val pkg = currentPackage()
        return when (val r = ScreenMatcher.decide(said, list)) {
            is MatchResult.NoMatch -> {
                if (fieldFocused) Outcome(false)
                else { log(DiagnosticsLog.SCREEN_NOMATCH, pkg, "", said.length); Outcome(true, "I don't see that on this screen. Say read screen, or scroll down.") }
            }
            is MatchResult.Blocked -> { log(DiagnosticsLog.SCREEN_BLOCKED, pkg, r.target.label); Outcome(true, "That's a ${short(r.target.label)} button. Please tap it yourself.") }
            is MatchResult.Ambiguous -> {
                options = r.options
                Outcome(true, "I see more than one. " + r.options.mapIndexed { i, o -> "${i + 1}: ${short(o.label)}" }.joinToString(". ") + ". Say number and the option.")
            }
            is MatchResult.Sure -> act(r.target, pkg)
        }
    }

    fun pickOption(n: Int): Outcome {
        val t = options.getOrNull(n - 1) ?: return Outcome(true, "Say read screen first, then pick a number.")
        options = emptyList()
        return act(t, currentPackage(), confirmed = true)
    }

    fun confirm(): Outcome {
        val t = pending ?: return Outcome(true, "Nothing is waiting. Say what you want to mark.")
        pending = null
        removeHighlight()
        return act(t, currentPackage(), confirmed = true)
    }

    fun cancel(): Outcome { pending = null; options = emptyList(); removeHighlight(); return Outcome(true, "Okay.") }

    fun readScreen(): Outcome {
        val list = targets().filter { it.kind != "field" && !ScreenMatcher.isBlocked(it.label) }
        if (list.isEmpty()) return Outcome(true, "I don't see anything to tap here.")
        options = list.take(6)
        return Outcome(true, options.mapIndexed { i, o -> "${i + 1}: ${short(o.label)}" }.joinToString(". ") + if (list.size > 6) ". And more below." else ".")
    }

    fun scroll(down: Boolean): Outcome {
        val root = rootInActiveWindow ?: return Outcome(true, "Nothing to scroll.")
        var scrollable: AccessibilityNodeInfo? = null
        fun walk(n: AccessibilityNodeInfo?) {
            if (n == null || scrollable != null) return
            if (n.isScrollable && n.isVisibleToUser) { scrollable = n; return }
            for (i in 0 until n.childCount) walk(n.getChild(i))
        }
        walk(root)
        val ok = scrollable?.performAction(if (down) AccessibilityNodeInfo.ACTION_SCROLL_FORWARD else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD) == true
        return Outcome(true, if (ok) (if (down) "Scrolled down." else "Scrolled up.") else "Can't scroll here.")
    }

    fun backScreen(): Outcome { performGlobalAction(GLOBAL_ACTION_BACK); return Outcome(true, "Back.") }

    /** Undo only where it's safe: tapping the same checkbox again. */
    fun undo(): Outcome {
        val (label, checkbox) = lastTapped ?: return Outcome(false)
        if (!checkbox) return Outcome(true, "I can't undo that here. Please change it on screen.")
        val t = targets().firstOrNull { it.label == label } ?: return Outcome(true, "That item isn't on screen anymore.")
        lastTapped = null
        return if (tap(t)) Outcome(true, "Unchecked: ${short(label)}.") else Outcome(true, "Couldn't undo it. Please change it on screen.")
    }

    /** Types into the focused field of any app, no keyboard needed. */
    fun typeIntoFocused(text: String): Boolean {
        val f = rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
        if (!f.isEditable) return false
        val before = f.text?.toString().orEmpty().let { if (f.isShowingHintText) "" else it }
        val joined = if (before.isBlank()) text else before.trimEnd() + " " + text
        val args = Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, joined) }
        val ok = f.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        log(if (ok) DiagnosticsLog.DICTATE_OK else DiagnosticsLog.DICTATE_FAIL, currentPackage(), "", text.length)
        return ok
    }

    fun hasFocusedField(): Boolean = rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.isEditable == true

    // ---------------------------------------------------------------- acting
    private fun act(t: ScreenTarget, pkg: String, confirmed: Boolean = false): Outcome {
        if (ScreenMatcher.isBlocked(t.label)) return Outcome(true, "That's a ${short(t.label)} button. Please tap it yourself.")
        if (!confirmed && !autoTap(this)) {
            pending = t
            showHighlight(t)
            log(DiagnosticsLog.SCREEN_POINT, pkg, t.label)
            return Outcome(true, "Found: ${short(t.label)}. Say yes to tap it.")
        }
        val ok = tap(t)
        log(if (ok) DiagnosticsLog.SCREEN_TAP else DiagnosticsLog.ERROR, pkg, t.label)
        if (ok) lastTapped = t.label to (t.kind == "checkbox")
        return Outcome(true, if (ok) "Tapped: ${short(t.label)}." else "Couldn't tap that. Please tap it yourself.")
    }

    private fun tap(t: ScreenTarget): Boolean {
        val n = nodes[t.id] ?: targets().firstOrNull { it.label == t.label }?.let { nodes[it.id] } ?: return false
        var c: AccessibilityNodeInfo? = n
        while (c != null && !c.isClickable) c = c.parent
        if (c?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true) return true
        // Some apps draw their own buttons; fall back to a real tap at the center.
        val r = Rect().also { n.getBoundsInScreen(it) }
        if (r.isEmpty) return false
        val path = Path().apply { moveTo(r.exactCenterX(), r.exactCenterY()) }
        return dispatchGesture(GestureDescription.Builder().addStroke(GestureDescription.StrokeDescription(path, 0, 60)).build(), null, null)
    }

    private fun showHighlight(t: ScreenTarget) {
        val n = nodes[t.id] ?: return
        val r = Rect().also { n.getBoundsInScreen(it) }
        main.post {
            removeHighlight()
            val wm = getSystemService(WindowManager::class.java)
            val box = FrameLayout(this).apply {
                background = GradientDrawable().apply { setStroke(10, Color.parseColor("#EA580C")); cornerRadius = 18f; setColor(Color.argb(40, 234, 88, 12)) }
            }
            val lp = WindowManager.LayoutParams(
                r.width() + 24, r.height() + 24, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT,
            ).apply { gravity = Gravity.TOP or Gravity.START; x = r.left - 12; y = r.top - 12 }
            try { wm.addView(box, lp); highlight = box } catch (_: Exception) { }
            main.removeCallbacks(clearHighlight)
            main.postDelayed(clearHighlight, 8000)
        }
    }

    private fun removeHighlight() {
        val v = highlight ?: return
        highlight = null
        try { getSystemService(WindowManager::class.java).removeView(v) } catch (_: Exception) { }
    }

    private fun short(label: String) = label.split(' ').take(10).joinToString(" ").trimEnd('.', ',')

    /** On-screen labels can include tenant names; they're only logged if the tester turns that on. */
    private fun log(kind: String, pkg: String, label: String, length: Int = label.length) {
        val shown = if (logLabels(this)) label.replace(Regex("\\d"), "#").take(80) else "label hidden, $length characters"
        DiagnosticsLog.add(kind, pkg, "", shown)
    }
}
