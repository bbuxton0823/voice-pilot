package com.cerespacifica.walkthrough

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView

class MainActivity : Activity() {

    private lateinit var setupStatus: TextView
    private lateinit var screenStatus: TextView
    private lateinit var serviceButton: Button
    private lateinit var summary: TextView
    private lateinit var log: TextView
    private val logListener: () -> Unit = { runOnUiThread { refreshLog() } }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        VoiceController.init(this)

        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(20), dp(18), dp(32))
        }
        fun heading(t: String) = col.addView(TextView(this).apply {
            text = t; textSize = 19f; typeface = Typeface.DEFAULT_BOLD; setPadding(0, dp(18), 0, dp(6))
        })
        fun body(t: String) = col.addView(TextView(this).apply { text = t; textSize = 15f; setPadding(0, 0, 0, dp(8)) })
        fun button(t: String, onTap: () -> Unit) = Button(this).apply {
            text = t; isAllCaps = false; minHeight = dp(48); setOnClickListener { onTap() }
        }.also { col.addView(it) }

        col.addView(TextView(this).apply { text = "Walkthrough Bridge"; textSize = 26f; typeface = Typeface.DEFAULT_BOLD })
        body("Universal mode: talk through your Bluetooth headset to type into any inspection app, move between fields, and take photos.")

        heading("1. Set up")
        setupStatus = TextView(this).apply { textSize = 15f; setPadding(0, 0, 0, dp(6)) }
        col.addView(setupStatus)
        button("Allow microphone, Bluetooth and notifications") { askPermissions() }
        button("Turn on Walkthrough Keyboard in settings") { startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS)) }
        button("Choose Walkthrough Keyboard") { getSystemService(InputMethodManager::class.java).showInputMethodPicker() }
        serviceButton = button("Start headset listening") {
            if (HeadsetService.running) HeadsetService.stop(this) else HeadsetService.start(this)
            serviceButton.postDelayed({ refreshSetup() }, 500)
        }

        heading("2. Screen Pilot (any inspection app)")
        body("Fill in whatever inspection app is open by voice. Say a finding; it points at the match and taps after you say \"yes\". It never taps save, submit, sign or delete.")
        screenStatus = TextView(this).apply { textSize = 15f; setPadding(0, 0, 0, dp(6)) }
        col.addView(screenStatus)
        button("Turn on Screen Pilot in Accessibility settings") { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
        button("Try it on a practice inspection") { startActivity(Intent(this, PracticeActivity::class.java)) }
        col.addView(Switch(this).apply {
            text = "Tap automatically when sure (otherwise it points and waits for \"yes\")"; textSize = 15f
            isChecked = getSharedPreferences("walkthrough", MODE_PRIVATE).getBoolean("auto_tap", false)
            setOnCheckedChangeListener { _, on -> VoiceController.setPref("auto_tap", on) }
        })
        col.addView(Switch(this).apply {
            text = "Include on-screen words in the test log (practice data only)"; textSize = 15f
            isChecked = getSharedPreferences("walkthrough", MODE_PRIVATE).getBoolean("log_labels", false)
            setOnCheckedChangeListener { _, on -> VoiceController.setPref("log_labels", on) }
        })

        heading("3. Options")
        col.addView(Switch(this).apply {
            text = "Use the headset microphone"; textSize = 15f; isChecked = VoiceController.routeToHeadset
            setOnCheckedChangeListener { _, on -> VoiceController.setPref("route_headset", on) }
        })
        col.addView(Switch(this).apply {
            text = "Spoken feedback in the headset"; textSize = 15f; isChecked = VoiceController.spokenFeedback
            setOnCheckedChangeListener { _, on -> VoiceController.setPref("spoken", on) }
        })

        heading("4. Practice typing here")
        body("Tap a field, press your headset button, and say a comment. Say \"next\" to move on. Commands: next, previous, enter, new line, undo, clear, where am I, photo. Say \"type next\" to type a command word.")
        col.addView(practiceField("Comments", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE, EditorInfo.IME_ACTION_NONE))
        col.addView(practiceField("Location", InputType.TYPE_CLASS_TEXT, EditorInfo.IME_ACTION_NEXT))
        col.addView(practiceField("Square feet", InputType.TYPE_CLASS_NUMBER, EditorInfo.IME_ACTION_DONE))

        heading("5. Test in your inspection app")
        body("Open the inspection app on a training or demo inspection, use the Walkthrough Keyboard in its text fields, then come back here. The scorecard below shows what worked in each app.")
        summary = TextView(this).apply { textSize = 15f; typeface = Typeface.MONOSPACE; setPadding(0, dp(4), 0, dp(8)) }
        col.addView(summary)
        val buttons = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        buttons.addView(Button(this).apply {
            text = "Share report"; isAllCaps = false; setOnClickListener { shareReport() }
        }, LinearLayout.LayoutParams(0, dp(52), 1f))
        buttons.addView(Button(this).apply {
            text = "Clear log"; isAllCaps = false; setOnClickListener { DiagnosticsLog.clear() }
        }, LinearLayout.LayoutParams(0, dp(52), 1f))
        col.addView(buttons)
        log = TextView(this).apply { textSize = 12f; typeface = Typeface.MONOSPACE; setPadding(0, dp(10), 0, 0); setTextIsSelectable(true) }
        col.addView(log)

        setContentView(ScrollView(this).apply { addView(col) })
    }

    private fun practiceField(hint: String, type: Int, action: Int): View = EditText(this).apply {
        this.hint = hint
        inputType = type
        imeOptions = action
        minHeight = dp(52)
        if (type and InputType.TYPE_TEXT_FLAG_MULTI_LINE != 0) minLines = 2
    }

    override fun onResume() {
        super.onResume()
        DiagnosticsLog.addListener(logListener)
        refreshSetup()
        refreshLog()
    }

    override fun onPause() {
        DiagnosticsLog.removeListener(logListener)
        super.onPause()
    }

    private fun permissionsNeeded(): Array<String> = buildList {
        add(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) add(Manifest.permission.BLUETOOTH_CONNECT)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.POST_NOTIFICATIONS)
    }.toTypedArray()

    private fun missingPermissions() = permissionsNeeded().filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }

    private fun askPermissions() {
        val missing = missingPermissions()
        if (missing.isNotEmpty()) requestPermissions(missing.toTypedArray(), 1) else refreshSetup()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        refreshSetup()
    }

    private fun refreshSetup() {
        val imm = getSystemService(InputMethodManager::class.java)
        val enabled = imm.enabledInputMethodList.any { it.packageName == packageName }
        val selected = Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)?.startsWith(packageName) == true
        val perms = missingPermissions().isEmpty()
        fun mark(ok: Boolean) = if (ok) "Done" else "To do"
        setupStatus.text = "Permissions: ${mark(perms)}\nKeyboard turned on: ${mark(enabled)}\n" +
            "Keyboard chosen: ${mark(selected)}\nHeadset listening: ${if (HeadsetService.running) "On" else "Off"}"
        screenStatus.text = "Screen Pilot: ${if (ScreenPilotService.instance != null) "On" else "Off (turn it on in Accessibility settings)"}"
        serviceButton.text = if (HeadsetService.running) "Stop headset listening" else "Start headset listening"
        serviceButton.isEnabled = perms || HeadsetService.running
    }

    private fun refreshLog() {
        summary.text = DiagnosticsLog.summary(packageName)
        log.text = DiagnosticsLog.snapshot().takeLast(80).reversed().joinToString("\n") { it.line() }
    }

    private fun shareReport() {
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "Walkthrough Bridge field test")
            putExtra(Intent.EXTRA_TEXT, DiagnosticsLog.report(packageName))
        }
        startActivity(Intent.createChooser(send, "Share field test report"))
    }
}
