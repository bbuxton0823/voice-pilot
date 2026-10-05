# Independent review guide

Voice Pilot adds hands-free voice control to a web-based NSPIRE inspection app (built and tested
against HACSM NSPIRE Practice, a training tool). An inspector talks through Bluetooth earbuds;
the pilot matches the phrase to a HUD NSPIRE standard and deficiency on screen and presses the
same button a finger would, then says back what it recorded.

## What to look at first
| Area | Files | Questions worth asking |
|---|---|---|
| Matching | voicePilot.ts (`markFromSpeech`, scoring) | Can a plausible phrase record the wrong deficiency or wrong area without asking? |
| HQS -> NSPIRE | hqsCrosswalk.ts | Are mappings and "retired" HQS items correct against NSPIRE v3.0? |
| Area guessing | voicePilot.ts (`areaForRoomName`) | Are Unit/Outside guesses safe; are shared rooms always asked? |
| Jev fallback | voicePilot.ts (`jevPick*`), server/route.ts | Thresholds (act at p >= 0.55 with a 0.15 margin); key stays server-side? |
| Learning loop | tools/label_misses.py, build_learned.py, learn_receiver.py, server/learn-route.ts | Can bad data reach inspectors without review? Is anything sensitive logged? |
| Voice output | clipSpeaker.ts, tools/make_voice_clips.py | Fallback when a clip is missing? |
| Setup UX | VoiceSetup.tsx, VoicePilotButton.tsx | Can a non-technical user get stuck on any step? |
| Security | server/*.ts, learn_receiver.py | Origin checks, rate limit, secret handling, input limits |
| Android Screen Pilot | android/app/src/main/java/.../ScreenPilotService.kt, ScreenMatcher.kt | Can it ever tap a save/submit/sign button? Does anything with tenant names reach the log? Is confirm-before-tap the default? |
| Android voice + keyboard | VoiceController.kt, WalkthroughKeyboard.kt, HeadsetService.kt | Headset mic routing, what dictated text is logged (length only) |

## Design decisions to challenge
- The pilot never submits or signs an inspection; it only marks findings, and every mark is read back and undoable.
- Severity and deadlines come from the app's own HUD buttons, not from the pilot.
- Phrases are logged for learning with long numbers and emails removed; no names, addresses or photos.
- Field corrections count as approved unless build_learned.py runs with --corrections-need-review.
- Jev and the AI labeler are optional. With neither, everything runs locally in the browser.

## Run it
    npm install
    npm run typecheck && npm run bundle && npm run harness
    pip install -r requirements.txt && playwright install chromium
    python live_test.py                       # 14 single-finding scenarios
    python live_test_rooms_and_batches.py     # 15 room / batch / undo scenarios
    python tools/hqs_phrases_test.py          # 17 HQS-era phrases
    python tools/learning_loop_test.py        # log -> sync -> receiver -> AI label -> review -> learned
    python tools/setup_walkthrough_test.py    # setup screens (uses tools/setup_harness)
    python tools/setup_help_messages_test.py
    python tools/setup_home_screen_test.py

The live tests drive a public training site in a headless browser and only create local drafts there.
Point them at your own deployment with APP_URL=https://your-app.example.
tools/jev_live_test.py needs JEV_KEY in the environment and makes real Jev API calls.

## Android tests
    cd android && ./gradlew testDebugUnitTest assembleDebug lintDebug
18 unit tests cover command parsing, the screen matcher (HUD wording, other apps' wording, refusing
save/submit/sign/delete, asking when vague) and the field-test scorecard. On-device behavior has not
been tested by the author's tooling yet; it needs a real phone.

## Known limits
- iPad web apps opened from the home screen may not allow speech recognition (WebKit limitation).
- Matching reads the app's button labels; wording changes in the app can change behavior.
- Retired-HQS explanations come from published comparisons, not an official HUD crosswalk.
