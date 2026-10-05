package com.cerespacifica.walkthrough

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * "Photo" opens the phone's camera and saves the picture to Pictures/Walkthrough,
 * so it shows first when the inspection app's "attach photo" picker opens.
 * With a chest mount, that's a hands-free point-of-view photo.
 */
class PhotoActivity : Activity() {

    companion object {
        private const val REQ = 41
        private const val KEY_URI = "uri"

        fun launch(ctx: Context): Boolean = try {
            ctx.startActivity(Intent(ctx, PhotoActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        } catch (e: Exception) {
            DiagnosticsLog.add(DiagnosticsLog.ERROR, message = "Couldn't open camera: ${e.message}")
            false
        }
    }

    private var uri: Uri? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        VoiceController.init(this)
        val saved = if (android.os.Build.VERSION.SDK_INT >= 33) savedInstanceState?.getParcelable(KEY_URI, Uri::class.java)
                    else @Suppress("DEPRECATION") savedInstanceState?.getParcelable(KEY_URI)
        if (saved != null) { uri = saved; return }
        val name = "walkthrough_" + SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date()) + ".jpg"
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, name)
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Walkthrough")
        }
        uri = contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
        if (uri == null) { fail("Couldn't create a photo file"); return }
        val capture = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
            .putExtra(MediaStore.EXTRA_OUTPUT, uri)
            .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        try {
            @Suppress("DEPRECATION") startActivityForResult(capture, REQ)
        } catch (e: ActivityNotFoundException) {
            fail("No camera app found")
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        uri?.let { outState.putParcelable(KEY_URI, it) }
    }

    @Deprecated("Uses the platform result API to avoid extra libraries")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION") super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ) return
        val kb = WalkthroughKeyboard.instance?.field
        if (resultCode == RESULT_OK) {
            DiagnosticsLog.add(DiagnosticsLog.PHOTO_OK, kb?.pkg.orEmpty(), kb?.label.orEmpty(), "Saved to Pictures/Walkthrough")
            VoiceController.say("Photo saved. It's first in your gallery.")
        } else {
            uri?.let { try { contentResolver.delete(it, null, null) } catch (_: Exception) { } }
            DiagnosticsLog.add(DiagnosticsLog.PHOTO_CANCEL, kb?.pkg.orEmpty(), kb?.label.orEmpty(), "Camera closed without a photo")
            VoiceController.say("No photo taken.")
        }
        finish()
    }

    private fun fail(msg: String) {
        DiagnosticsLog.add(DiagnosticsLog.ERROR, message = msg)
        VoiceController.say("$msg.")
        uri?.let { try { contentResolver.delete(it, null, null) } catch (_: Exception) { } }
        finish()
    }
}
