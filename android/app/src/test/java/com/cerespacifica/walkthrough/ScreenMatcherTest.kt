package com.cerespacifica.walkthrough

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ScreenMatcherTest {
    private val screen = listOf(
        "Smoke alarm is not installed where required.", "Smoke alarm is obstructed.",
        "Smoke alarm does not produce an audio or visual alarm when tested.",
        "Outlet or switch is damaged.", "Outlet does not have visible damage and testing indicates it is not energized.",
        "Window cannot be secured.", "Window will not open or stay open.", "Toilet is not secured at the base.",
        "Next room", "Save inspection",
    ).mapIndexed { i, l -> ScreenTarget(i, l, if (i < 8) "checkbox" else "button") }

    private fun sure(said: String): String = (ScreenMatcher.decide(said, screen) as MatchResult.Sure).target.label

    @Test fun everydayWordingFindsHudLabels() {
        assertEquals("Smoke alarm is not installed where required.", sure("smoke alarm missing"))
        assertEquals("Smoke alarm does not produce an audio or visual alarm when tested.", sure("smoke detector not working"))
        assertEquals("Outlet does not have visible damage and testing indicates it is not energized.", sure("dead outlet"))
        assertEquals("Window cannot be secured.", sure("window won't lock"))
        assertEquals("Toilet is not secured at the base.", sure("toilet loose at the base"))
    }

    @Test fun sayingTheLabelWorks() {
        assertEquals("Next room", sure("next room"))
        assertEquals("Window will not open or stay open.", sure("window will not open or stay open"))
    }

    @Test fun neverPressesSaveSubmitOrSign() {
        assertTrue(ScreenMatcher.decide("save inspection", screen) is MatchResult.Blocked)
        listOf("Submit", "Sign here", "Complete inspection", "Delete", "Sync now", "Upload results").forEach {
            assertTrue(it, ScreenMatcher.isBlocked(it))
        }
        listOf("Smoke alarm", "Next room", "Window cannot be secured").forEach { assertTrue(it, !ScreenMatcher.isBlocked(it)) }
    }

    @Test fun vaguePhrasesAskOrMiss() {
        assertTrue(ScreenMatcher.decide("smoke alarm", screen) is MatchResult.Ambiguous)
        assertTrue(ScreenMatcher.decide("banana phone", screen) is MatchResult.NoMatch)
    }

    @Test fun worksOnAnyAppsWording() {
        val other = listOf("Fail - Smoke Detector Missing", "Pass - Smoke Detector", "Fail - GFCI Inoperable", "Add Photo")
            .mapIndexed { i, l -> ScreenTarget(i, l) }
        val r = ScreenMatcher.decide("smoke detector missing", other) as MatchResult.Sure
        assertEquals("Fail - Smoke Detector Missing", r.target.label)
        assertEquals("Fail - GFCI Inoperable", (ScreenMatcher.decide("gfci doesn't trip", other) as MatchResult.Sure).target.label)
    }
}
