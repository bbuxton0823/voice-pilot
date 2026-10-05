# Walkthrough Bridge (v0.2: headphones, universal keyboard, Screen Pilot)

Talk through a Bluetooth headset to type into any Android inspection app, move between
fields, and take photos. Nothing here touches the inspection app's login or data
directly; it only types and presses keys like a keyboard would.

## Install (sideload)
1. Copy WalkthroughBridge-0.1.0-debug.apk to the phone and open it. Allow "install unknown apps" for your file manager when asked.
2. Open Walkthrough Bridge and follow the four setup steps on screen.

## Headset controls
- 1 press: talk (press again to stop)
- 2 presses: next field
- 3 presses: say which field you're in
- Skip forward / back buttons (if your headset has them): next / previous field

## Voice commands (whole phrase only)
next, previous, enter, new line, undo / scratch that, clear field, where am I, photo, stop.
Anything else is typed. Say "type next" to type a command word.

## Screen Pilot: fill in any inspection app by voice (new in 0.2)
Turn it on: Walkthrough app > "Turn on Screen Pilot in Accessibility settings" > Walkthrough Screen Pilot > On.
Then open any inspection app and talk:
- Say a finding ("smoke alarm missing", "dead outlet", "window won't lock"). It highlights the
  matching button in orange and says "Found ... say yes to tap it". Say "yes" (or "no").
- "read screen" lists what's tappable; "number 2" picks one; "scroll down" / "scroll up";
  "previous screen"; "undo" unchecks the last checkbox it tapped.
- "comment ..." or "type ..." always types into the focused field (no keyboard needed).
- It never taps save, submit, sign, complete, delete, sync or upload. You do those.
- "Tap automatically when sure" skips the "yes" step once you trust it in an app.
- Practice first on the built-in fake inspection ("Try it on a practice inspection").
- On-screen words are NOT written to the test log unless you turn that on (practice data only),
  because real inspection screens show tenant names and addresses.
Screen Pilot works only on the phone in your hand. It has no remote control of any kind.

## Field test
Practice in the app's own test fields first, then use a training inspection in your
inspection app. The scorecard shows, per app: text fields seen and whether they had labels,
dictation typed vs. failed, next/previous moved vs. stayed put, photos saved.
"Share report" sends it as text. Dictated words are not logged, only their length.

## Build from source
Android SDK 34, JDK 17+:  ./gradlew testDebugUnitTest assembleDebug
