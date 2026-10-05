package com.cerespacifica.walkthrough

import org.junit.Assert.assertEquals
import org.junit.Test

class CommandParserTest {
    private fun p(s: String) = CommandParser.parse(s)

    @Test fun navigationCommands() {
        assertEquals(Command.NextField, p("Next"))
        assertEquals(Command.NextField, p("next field."))
        assertEquals(Command.PreviousField, p("Go back"))
        assertEquals(Command.Enter, p("enter"))
        assertEquals(Command.NewLine, p("New line"))
    }

    @Test fun editingAndInfoCommands() {
        assertEquals(Command.UndoLast, p("Scratch that"))
        assertEquals(Command.ClearField, p("clear field"))
        assertEquals(Command.WhereAmI, p("Where am I?"))
        assertEquals(Command.Photo, p("Take a photo"))
        assertEquals(Command.Stop, p("never mind"))
    }

    @Test fun commandWordsInsideSentencesAreDictation() {
        assertEquals(Command.Dictate("Next to the sink, cabinet door broken"), p("Next to the sink, cabinet door broken"))
        assertEquals(Command.Dictate("back bedroom window cracked"), p("back bedroom window cracked"))
    }

    @Test fun typePrefixForcesDictation() {
        assertEquals(Command.Dictate("next", forceType = true), p("type next"))
        assertEquals(Command.Dictate("Smoke alarm missing", forceType = true), p("Type Smoke alarm missing"))
    }

    @Test fun cleansSpacingAndEmpty() {
        assertEquals(Command.Dictate("Outlet  dead".replace("  ", " ")), p("  Outlet   dead "))
        assertEquals(Command.Empty, p("   "))
        assertEquals(Command.Empty, p("?!"))
    }

    @Test fun screenPilotCommands() {
        assertEquals(Command.Confirm, p("Yes"))
        assertEquals(Command.Confirm, p("tap it"))
        assertEquals(Command.ReadScreen, p("read screen"))
        assertEquals(Command.ScrollDown, p("scroll down"))
        assertEquals(Command.BackScreen, p("previous screen"))
        assertEquals(Command.PickOption(2), p("number 2"))
        assertEquals(Command.PickOption(3), p("option three"))
        assertEquals(Command.Stop, p("no"))
    }

    @Test fun commentAndTypeAlwaysType() {
        assertEquals(Command.Dictate("battery removed by tenant", forceType = true), p("comment battery removed by tenant"))
        assertEquals(Command.Dictate("smoke alarm missing", forceType = false), p("smoke alarm missing"))
    }

    @Test fun commandNames() {
        assertEquals("NextField", Command.NextField.name())
        assertEquals("Dictate", Command.Dictate("x").name())
    }
}
