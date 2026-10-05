package com.cerespacifica.walkthrough

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class DiagnosticsTest {
    @Before fun reset() { DiagnosticsLog.file = null; DiagnosticsLog.clock = { 0L }; DiagnosticsLog.clear() }

    @Test fun fieldLabelsAndKinds() {
        val notes = FieldInfo.build("com.vendor.nspire", "Comments", null, null, 1 or 0x00020000, 12)
        assertEquals("notes", notes.kind)
        assertEquals("Comments field", notes.spoken())
        val bare = FieldInfo.build("com.vendor.nspire", "", null, null, 2, -1)
        assertFalse(bare.labeled)
        assertEquals("Unlabeled number field", bare.spoken())
        val fallback = FieldInfo.build("x", null, "Location", "loc", 1, 3)
        assertEquals("Location", fallback.label)
    }

    @Test fun scorecardSaysItWorks() {
        val app = "com.vendor.nspire"
        DiagnosticsLog.add(DiagnosticsLog.FIELD, app, "Comments", "notes")
        DiagnosticsLog.add(DiagnosticsLog.DICTATE_OK, app, "Comments", "Typed 20 characters")
        DiagnosticsLog.add(DiagnosticsLog.NAV_OK, app, "Location", "Moved")
        DiagnosticsLog.add(DiagnosticsLog.FIELD, app, "Location", "text")
        val s = DiagnosticsLog.summary("com.cerespacifica.walkthrough")
        assertTrue(s, s.contains("Universal mode works here"))
        assertTrue(s, s.contains("Text fields seen: 2 (2 with labels)"))
    }

    @Test fun scorecardFlagsNavigationProblems() {
        val app = "com.vendor.nspire"
        DiagnosticsLog.add(DiagnosticsLog.DICTATE_OK, app, "Comments", "")
        repeat(3) { DiagnosticsLog.add(DiagnosticsLog.NAV_NO_MOVE, app, "Comments", "") }
        assertTrue(DiagnosticsLog.summary().contains("field-to-field moves mostly don't"))
    }

    @Test fun ownAppIsExcludedFromScorecard() {
        DiagnosticsLog.add(DiagnosticsLog.DICTATE_OK, "com.cerespacifica.walkthrough", "Comments", "")
        assertTrue(DiagnosticsLog.summary("com.cerespacifica.walkthrough").startsWith("No other apps tested yet"))
    }

    @Test fun reportIncludesLog() {
        DiagnosticsLog.add(DiagnosticsLog.PHOTO_OK, "com.vendor.nspire", "", "Saved")
        val r = DiagnosticsLog.report()
        assertTrue(r.contains("FULL LOG"))
        assertTrue(r.contains("PHOTO_OK"))
    }
}
