package com.cerespacifica.walkthrough

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.KeyEvent

/**
 * Listens for the Bluetooth headset's play/pause button while an inspection is running.
 *   1 press  -> start or stop listening
 *   2 presses -> next field
 *   3 presses -> say which field you're in
 * Headsets with skip buttons: skip forward = next field, skip back = previous field.
 *
 * Android only sends headset buttons to the app that last played audio, so this
 * service plays silence in the background to stay first in line.
 */
class HeadsetService : Service() {

    companion object {
        const val ACTION_TALK = "com.cerespacifica.walkthrough.TALK"
        const val ACTION_STOP = "com.cerespacifica.walkthrough.STOP"
        private const val CHANNEL = "walkthrough"
        private const val NOTIFICATION_ID = 7
        private const val PRESS_WINDOW_MS = 450L
        @Volatile var running = false
            private set

        fun start(ctx: Context) = ctx.startForegroundService(Intent(ctx, HeadsetService::class.java))
        fun stop(ctx: Context) = ctx.startService(Intent(ctx, HeadsetService::class.java).setAction(ACTION_STOP))
    }

    private lateinit var session: MediaSession
    private var silence: AudioTrack? = null
    private val main = Handler(Looper.getMainLooper())
    private var presses = 0
    private val flushPresses = Runnable {
        val n = presses
        presses = 0
        DiagnosticsLog.add(DiagnosticsLog.BUTTON, message = "Headset button x$n")
        when (n) {
            1 -> VoiceController.toggleListening()
            2 -> VoiceController.execute(Command.NextField)
            else -> VoiceController.execute(Command.WhereAmI)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        VoiceController.init(this)
        createChannel()
        val n = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            startForeground(NOTIFICATION_ID, n,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIFICATION_ID, n)
        }
        session = MediaSession(this, "WalkthroughHeadset").apply {
            setCallback(callback)
            setPlaybackState(
                PlaybackState.Builder()
                    .setActions(PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or
                        PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS)
                    .setState(PlaybackState.STATE_PLAYING, 0, 1f)
                    .build()
            )
            isActive = true
        }
        startSilence()
        running = true
        DiagnosticsLog.add(DiagnosticsLog.BUTTON, message = "Headset listening started")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_TALK -> VoiceController.toggleListening()
            ACTION_STOP -> { stopSelf(); return START_NOT_STICKY }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        main.removeCallbacks(flushPresses)
        VoiceController.stopListening()
        session.isActive = false
        session.release()
        silence?.run { try { stop() } catch (_: Exception) { }; release() }
        silence = null
        DiagnosticsLog.add(DiagnosticsLog.BUTTON, message = "Headset listening stopped")
        super.onDestroy()
    }

    private val callback = object : MediaSession.Callback() {
        override fun onMediaButtonEvent(mediaButtonIntent: Intent): Boolean {
            val ev: KeyEvent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                mediaButtonIntent.getParcelableExtra(Intent.EXTRA_KEY_EVENT, KeyEvent::class.java)
            } else {
                @Suppress("DEPRECATION") mediaButtonIntent.getParcelableExtra(Intent.EXTRA_KEY_EVENT)
            }
            if (ev == null || ev.action != KeyEvent.ACTION_DOWN || ev.repeatCount != 0) return true
            when (ev.keyCode) {
                KeyEvent.KEYCODE_HEADSETHOOK, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
                KeyEvent.KEYCODE_MEDIA_PLAY, KeyEvent.KEYCODE_MEDIA_PAUSE -> {
                    presses++
                    main.removeCallbacks(flushPresses)
                    main.postDelayed(flushPresses, PRESS_WINDOW_MS)
                }
                KeyEvent.KEYCODE_MEDIA_NEXT -> VoiceController.execute(Command.NextField)
                KeyEvent.KEYCODE_MEDIA_PREVIOUS -> VoiceController.execute(Command.PreviousField)
                else -> return false
            }
            return true
        }
    }

    private fun startSilence() {
        try {
            val rate = 8000
            val track = AudioTrack.Builder()
                .setAudioAttributes(AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                .setAudioFormat(AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(rate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                .setTransferMode(AudioTrack.MODE_STATIC)
                .setBufferSizeInBytes(rate * 2)
                .build()
            track.write(ShortArray(rate), 0, rate)
            track.setLoopPoints(0, rate, -1)
            track.play()
            silence = track
        } catch (e: Exception) {
            DiagnosticsLog.add(DiagnosticsLog.ERROR, message = "Couldn't hold headset buttons: ${e.message}")
        }
    }

    private fun createChannel() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Inspection listening", NotificationManager.IMPORTANCE_LOW))
    }

    private fun buildNotification(): Notification {
        val talk = PendingIntent.getService(this, 1, Intent(this, HeadsetService::class.java).setAction(ACTION_TALK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val stop = PendingIntent.getService(this, 2, Intent(this, HeadsetService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val open = PendingIntent.getActivity(this, 3, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Walkthrough is ready")
            .setContentText("Press your headset button to talk")
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(null, "Talk", talk).build())
            .addAction(Notification.Action.Builder(null, "Stop", stop).build())
            .build()
    }
}
