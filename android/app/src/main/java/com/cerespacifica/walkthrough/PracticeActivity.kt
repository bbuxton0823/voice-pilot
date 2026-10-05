package com.cerespacifica.walkthrough

import android.app.Activity
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

/**
 * A fake inspection screen for trying Screen Pilot safely: checkboxes worded like HUD
 * deficiencies, a comments box, and a Save button the pilot must refuse to press.
 */
class PracticeActivity : Activity() {
    companion object { @Volatile var visible = false }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(18), dp(20), dp(18), dp(32)) }
        col.addView(TextView(this).apply { text = "Practice inspection (fake data)"; textSize = 24f; typeface = Typeface.DEFAULT_BOLD })
        col.addView(TextView(this).apply {
            text = "Try: \"smoke alarm missing\", then \"yes\". \"Read screen\". \"Comment battery removed\". \"Save\" (it should refuse)."
            textSize = 15f; setPadding(0, dp(6), 0, dp(14))
        })
        fun section(title: String, items: List<String>) {
            col.addView(TextView(this).apply { text = title; textSize = 19f; typeface = Typeface.DEFAULT_BOLD; setPadding(0, dp(14), 0, dp(4)) })
            items.forEach { label -> col.addView(CheckBox(this).apply { text = label; textSize = 17f; minHeight = dp(52) }) }
        }
        section("Smoke Alarm", listOf("Smoke alarm is not installed where required.", "Smoke alarm is obstructed.",
            "Smoke alarm does not produce an audio or visual alarm when tested."))
        section("Electrical - Outlet and Switch", listOf("Outlet or switch is damaged.",
            "Outlet does not have visible damage and testing indicates it is not energized.",
            "Testing indicates a three-pronged outlet is not properly wired or grounded."))
        section("Window", listOf("Window cannot be secured.", "Window will not open or stay open.", "Window will not close."))
        section("Toilet", listOf("Toilet is not secured at the base.", "Toilet component is damaged, inoperable, or missing."))
        col.addView(EditText(this).apply { hint = "Inspector comments"; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE; minLines = 2 })
        col.addView(Button(this).apply { text = "Next room"; isAllCaps = false; setOnClickListener { Toast.makeText(this@PracticeActivity, "Next room", Toast.LENGTH_SHORT).show() } })
        col.addView(Button(this).apply { text = "Save inspection"; isAllCaps = false; setOnClickListener { Toast.makeText(this@PracticeActivity, "Saved (practice)", Toast.LENGTH_SHORT).show() } })
        setContentView(ScrollView(this).apply { addView(col) })
    }

    override fun onResume() { super.onResume(); visible = true }
    override fun onPause() { visible = false; super.onPause() }
}
