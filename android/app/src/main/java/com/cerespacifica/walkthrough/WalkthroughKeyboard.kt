package com.cerespacifica.walkthrough

import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.inputmethodservice.InputMethodService
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Universal mode. When the inspector taps any text field in any app, this keyboard
 * is what appears. It types dictated text, moves between fields, and reports what
 * worked so a field test shows how far universal mode gets in each app.
 */
class WalkthroughKeyboard : InputMethodService() {

    companion object {
        @Volatile var instance: WalkthroughKeyboard? = null
            private set
        private const val NAV_TIMEOUT_MS = 1200L
    }

    var field: FieldInfo? = null
        private set
    private var editorInfo: EditorInfo? = null
    private var lastCommit = 0
    private var navFromKey: String? = null
    private var navPending = false
    private val main = Handler(Looper.getMainLooper())
    private var status: TextView? = null
    private var talkButton: Button? = null
    private val stateListener: (Boolean) -> Unit = { updateTalk(it) }

    private val navCheck = Runnable {
        if (navPending) {
            navPending = false
            DiagnosticsLog.add(DiagnosticsLog.NAV_NO_MOVE, field?.pkg.orEmpty(), field?.label.orEmpty(), "Focus stayed in the same field")
            VoiceController.say("That didn't move. Tap the next field.")
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        VoiceController.init(this)
        VoiceController.addStateListener(stateListener)
    }

    override fun onDestroy() {
        VoiceController.removeStateListener(stateListener)
        if (instance === this) instance = null
        super.onDestroy()
    }

    fun hasField(): Boolean = currentInputConnection != null && field != null && editorInfo?.inputType != 0

    override fun onStartInput(attribute: EditorInfo, restarting: Boolean) {
        super.onStartInput(attribute, restarting)
        editorInfo = attribute
        val f = FieldInfo.build(attribute.packageName, attribute.hintText, attribute.label,
            attribute.fieldName, attribute.inputType, attribute.fieldId)
        if (attribute.inputType == 0) { field = null; updateStatus(); return }
        val previousKey = field?.key
        field = f
        lastCommit = 0
        if (navPending) {
            navPending = false
            main.removeCallbacks(navCheck)
            if (navFromKey != f.key) {
                DiagnosticsLog.add(DiagnosticsLog.NAV_OK, f.pkg, f.label, "Moved to this field")
                VoiceController.say(f.spoken())
            } else {
                DiagnosticsLog.add(DiagnosticsLog.NAV_NO_MOVE, f.pkg, f.label, "Focus stayed in the same field")
            }
        }
        if (!restarting && previousKey != f.key) {
            DiagnosticsLog.add(DiagnosticsLog.FIELD, f.pkg, f.label, f.kind)
        }
        updateStatus()
    }

    override fun onFinishInput() {
        super.onFinishInput()
        updateStatus()
    }

    // ---------------------------------------------------------------- actions
    fun dictate(text: String): Boolean {
        val ic = currentInputConnection ?: return false
        val before = ic.getTextBeforeCursor(1, 0)
        val sep = if (before.isNullOrEmpty() || before.last().isWhitespace()) "" else " "
        val chunk = sep + text
        val ok = ic.commitText(chunk, 1)
        val f = field
        if (ok) {
            lastCommit = chunk.length
            DiagnosticsLog.add(DiagnosticsLog.DICTATE_OK, f?.pkg.orEmpty(), f?.label.orEmpty(), "Typed ${text.length} characters")
        } else {
            DiagnosticsLog.add(DiagnosticsLog.DICTATE_FAIL, f?.pkg.orEmpty(), f?.label.orEmpty(), "Field refused text")
        }
        return ok
    }

    fun navigate(forward: Boolean) {
        val ic = currentInputConnection ?: return
        navFromKey = field?.key
        navPending = true
        main.removeCallbacks(navCheck)
        main.postDelayed(navCheck, NAV_TIMEOUT_MS)
        val action = (editorInfo?.imeOptions ?: 0) and EditorInfo.IME_MASK_ACTION
        when {
            forward && action == EditorInfo.IME_ACTION_NEXT -> ic.performEditorAction(EditorInfo.IME_ACTION_NEXT)
            !forward && action == EditorInfo.IME_ACTION_PREVIOUS -> ic.performEditorAction(EditorInfo.IME_ACTION_PREVIOUS)
            else -> {
                val meta = if (forward) 0 else KeyEvent.META_SHIFT_ON
                val t = SystemClock.uptimeMillis()
                ic.sendKeyEvent(KeyEvent(t, t, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_TAB, 0, meta))
                ic.sendKeyEvent(KeyEvent(t, t, KeyEvent.ACTION_UP, KeyEvent.KEYCODE_TAB, 0, meta))
            }
        }
    }

    fun enter() {
        val ic = currentInputConnection ?: return
        val info = editorInfo
        val action = (info?.imeOptions ?: 0) and EditorInfo.IME_MASK_ACTION
        val multiLine = field?.kind == "notes"
        val noEnterAction = ((info?.imeOptions ?: 0) and EditorInfo.IME_FLAG_NO_ENTER_ACTION) != 0
        if (!multiLine && !noEnterAction && action != EditorInfo.IME_ACTION_NONE && action != EditorInfo.IME_ACTION_UNSPECIFIED) {
            ic.performEditorAction(action)
        } else {
            sendDownUpKeyEvents(KeyEvent.KEYCODE_ENTER)
        }
    }

    fun newLine() { currentInputConnection?.commitText("\n", 1) }

    fun undoLast(): Boolean {
        val ic = currentInputConnection ?: return false
        if (lastCommit <= 0) return false
        ic.deleteSurroundingText(lastCommit, 0)
        lastCommit = 0
        return true
    }

    fun clearField() {
        val ic = currentInputConnection ?: return
        ic.performContextMenuAction(android.R.id.selectAll)
        ic.commitText("", 1)
        lastCommit = 0
    }

    fun launchPhoto(): Boolean = PhotoActivity.launch(this)

    // ---------------------------------------------------------------- keyboard UI
    private fun dark(): Boolean =
        (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    override fun onCreateInputView(): View {
        val bg = if (dark()) Color.parseColor("#1F1E1C") else Color.parseColor("#ECEAE6")
        val fg = if (dark()) Color.parseColor("#EDEAE4") else Color.parseColor("#1F1E1C")
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(bg)
            setPadding(dp(8), dp(8), dp(8), dp(10))
        }
        status = TextView(this).apply {
            setTextColor(fg); textSize = 14f
            setPadding(dp(6), dp(2), dp(6), dp(8))
        }
        root.addView(status)

        talkButton = key("Talk", primary = true) { VoiceController.toggleListening() }
        root.addView(row(talkButton!!))
        root.addView(row(
            key("Previous") { VoiceController.execute(Command.PreviousField) },
            key("Next") { VoiceController.execute(Command.NextField) },
            key("Enter") { VoiceController.execute(Command.Enter) },
        ))
        root.addView(row(
            key("Undo") { VoiceController.execute(Command.UndoLast) },
            key("Clear") { VoiceController.execute(Command.ClearField) },
            key("Photo") { VoiceController.execute(Command.Photo) },
            key("Keyboard") { switchKeyboard() },
        ))
        updateStatus()
        updateTalk(VoiceController.listening)
        return root
    }

    private fun row(vararg views: View) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        views.forEach { addView(it, LinearLayout.LayoutParams(0, dp(56), 1f).apply { setMargins(dp(3), dp(3), dp(3), dp(3)) }) }
    }

    private fun key(label: String, primary: Boolean = false, onTap: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 15f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        if (primary) { setBackgroundColor(Color.parseColor("#B8430A")); setTextColor(Color.WHITE) }
        setOnClickListener { onTap() }
    }

    private fun switchKeyboard() {
        if (!switchToNextInputMethod(false)) {
            getSystemService(android.view.inputmethod.InputMethodManager::class.java)?.showInputMethodPicker()
        }
    }

    private fun updateTalk(listening: Boolean) {
        main.post { talkButton?.text = if (listening) "Listening... tap to stop" else "Talk (or press headset button)" }
    }

    private fun updateStatus() {
        val f = field
        main.post {
            status?.text = if (f == null) "No text field selected" else "${f.spoken()}  in  ${f.pkg.substringAfterLast('.')}"
        }
    }
}
