package com.cerespacifica.walkthrough

import android.content.Context
import android.content.Intent
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * Shared by the headset service and the keyboard. Listens through the Bluetooth
 * headset mic when one is connected, turns speech into a command, carries it out
 * through the keyboard, and answers in the headset.
 * Everything here runs on the main thread.
 */
object VoiceController {
    private var app: Context? = null
    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val main = Handler(Looper.getMainLooper())
    private val stateListeners = mutableListOf<(Boolean) -> Unit>()

    var listening = false
        private set

    private const val PREFS = "walkthrough"
    val routeToHeadset get() = prefs()?.getBoolean("route_headset", true) ?: true
    val spokenFeedback get() = prefs()?.getBoolean("spoken", true) ?: true

    private fun prefs() = app?.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun setPref(key: String, value: Boolean) { prefs()?.edit()?.putBoolean(key, value)?.apply() }

    fun init(ctx: Context) {
        if (app != null) return
        app = ctx.applicationContext
        DiagnosticsLog.file = java.io.File(ctx.applicationContext.filesDir, "diagnostics.log")
        tts = TextToSpeech(app) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) tts?.language = Locale.US
        }
    }

    fun addStateListener(l: (Boolean) -> Unit) { stateListeners.add(l) }
    fun removeStateListener(l: (Boolean) -> Unit) { stateListeners.remove(l) }
    private fun setListening(v: Boolean) { listening = v; stateListeners.toList().forEach { it(v) } }

    fun say(text: String) {
        if (!spokenFeedback || !ttsReady) return
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "wt-${System.nanoTime()}")
    }

    fun toggleListening() { if (listening) stopListening() else startListening() }

    fun startListening() {
        val ctx = app ?: return
        if (listening) return
        if (!SpeechRecognizer.isRecognitionAvailable(ctx)) {
            DiagnosticsLog.add(DiagnosticsLog.ERROR, message = "Speech recognition isn't available on this phone")
            say("Speech recognition isn't available on this phone.")
            return
        }
        tts?.stop()
        val routed = if (routeToHeadset) routeMic(true) else false
        try { ToneGenerator(AudioManager.STREAM_MUSIC, 70).startTone(ToneGenerator.TONE_PROP_BEEP, 120) } catch (_: Exception) { }
        setListening(true)
        // Bluetooth headset mics take a moment to switch on.
        main.postDelayed({ beginRecognition(ctx) }, if (routed) 600L else 150L)
    }

    private fun beginRecognition(ctx: Context) {
        if (!listening) return
        val r = recognizer ?: SpeechRecognizer.createSpeechRecognizer(ctx).also {
            it.setRecognitionListener(listener)
            recognizer = it
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.US.toLanguageTag())
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            .putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, ctx.packageName)
        try { r.startListening(intent) } catch (e: Exception) {
            DiagnosticsLog.add(DiagnosticsLog.ERROR, message = "Couldn't start listening: ${e.message}")
            finishListening()
        }
    }

    fun stopListening() {
        recognizer?.cancel()
        finishListening()
    }

    private fun finishListening() {
        routeMic(false)
        setListening(false)
    }

    /** Sends the mic through the Bluetooth headset. Returns true if a headset mic was found. */
    private fun routeMic(on: Boolean): Boolean {
        val am = app?.getSystemService(AudioManager::class.java) ?: return false
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!on) { am.clearCommunicationDevice(); return false }
                val dev = am.availableCommunicationDevices.firstOrNull {
                    it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || it.type == AudioDeviceInfo.TYPE_BLE_HEADSET
                }
                if (dev != null && am.setCommunicationDevice(dev)) {
                    DiagnosticsLog.add(DiagnosticsLog.MIC, message = "Using headset mic: ${dev.productName}")
                    true
                } else {
                    DiagnosticsLog.add(DiagnosticsLog.MIC, message = "No headset mic found; using phone mic")
                    false
                }
            } else {
                @Suppress("DEPRECATION")
                if (on) { am.startBluetoothSco(); am.isBluetoothScoOn = true } else { am.stopBluetoothSco(); am.isBluetoothScoOn = false }
                if (on) DiagnosticsLog.add(DiagnosticsLog.MIC, message = "Requested headset mic (older Android)")
                on
            }
        } catch (e: SecurityException) {
            DiagnosticsLog.add(DiagnosticsLog.ERROR, message = "Bluetooth permission missing: ${e.message}")
            false
        }
    }

    private val listener = object : RecognitionListener {
        override fun onResults(results: Bundle) {
            val heard = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
            finishListening()
            if (heard.isBlank()) { say("Didn't catch that."); return }
            handle(heard)
        }
        override fun onError(error: Int) {
            finishListening()
            val msg = when (error) {
                SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Didn't catch that."
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is off."
                SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "No connection for speech."
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech is busy. Try again."
                else -> "Speech error."
            }
            DiagnosticsLog.add(DiagnosticsLog.ERROR, message = "Speech error $error")
            say(msg)
        }
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onPartialResults(partialResults: Bundle?) {}
        override fun onEvent(eventType: Int, params: Bundle?) {}
    }

    fun handle(heard: String) {
        val kb = WalkthroughKeyboard.instance
        val cmd = CommandParser.parse(heard)
        // Dictated words can include tenant details, so the log keeps only their length.
        val note = if (cmd is Command.Dictate) "Dictation, ${cmd.text.length} characters" else "Command: ${cmd.name()}"
        DiagnosticsLog.add(DiagnosticsLog.HEARD, kb?.field?.pkg.orEmpty(), kb?.field?.label.orEmpty(), note)
        execute(cmd)
    }

    fun execute(cmd: Command) {
        val kb = WalkthroughKeyboard.instance
        val sp = ScreenPilotService.instance
        val hasField = kb?.hasField() == true
        fun needField(): Boolean {
            if (hasField) return true
            DiagnosticsLog.add(DiagnosticsLog.NO_FIELD, message = "Command needed a text field: ${cmd.name()}")
            say("Tap a text field first, with the Walkthrough keyboard on.")
            return false
        }
        fun screenOff() = say("Turn on Screen Pilot in the Walkthrough app first.")
        when (cmd) {
            is Command.Dictate -> {
                // Screen Pilot first: does the phrase name something on screen?
                if (sp != null && !cmd.forceType) {
                    val r = sp.handlePhrase(cmd.text, fieldFocused = hasField || sp.hasFocusedField())
                    if (r.handled) { say(r.say); return }
                }
                when {
                    hasField -> { if (kb!!.dictate(cmd.text)) say("Typed.") else say("That field didn't take it.") }
                    sp != null && sp.typeIntoFocused(cmd.text) -> say("Typed.")
                    else -> needField()
                }
            }
            Command.Confirm -> if (sp != null) say(sp.confirm().say) else screenOff()
            is Command.PickOption -> if (sp != null) say(sp.pickOption(cmd.n).say) else screenOff()
            Command.ReadScreen -> if (sp != null) say(sp.readScreen().say) else screenOff()
            Command.ScrollDown -> if (sp != null) say(sp.scroll(true).say) else screenOff()
            Command.ScrollUp -> if (sp != null) say(sp.scroll(false).say) else screenOff()
            Command.BackScreen -> if (sp != null) say(sp.backScreen().say) else screenOff()
            Command.NextField -> if (needField()) kb!!.navigate(forward = true)
            Command.PreviousField -> if (needField()) kb!!.navigate(forward = false)
            Command.Enter -> if (needField()) { kb!!.enter(); say("Entered.") }
            Command.NewLine -> if (needField()) kb!!.newLine()
            Command.UndoLast -> {
                val r = sp?.undo()
                if (r != null && r.handled) say(r.say)
                else if (needField()) { if (kb!!.undoLast()) say("Removed.") else say("Nothing to undo.") }
            }
            Command.ClearField -> if (needField()) { kb!!.clearField(); say("Cleared.") }
            Command.WhereAmI -> say(kb?.field?.takeIf { hasField }?.spoken() ?: "No text field selected.")
            Command.Photo -> {
                val ctx = app ?: return
                val ok = kb?.launchPhoto() ?: PhotoActivity.launch(ctx)
                if (!ok) say("Couldn't open the camera. Tap photo on the keyboard instead.")
            }
            Command.Stop -> say(sp?.cancel()?.say ?: "Okay.")
            Command.Empty -> say("Didn't catch that.")
        }
    }
}
