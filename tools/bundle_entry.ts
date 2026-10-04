// Builds voicePilot.bundle.js, used by the Python tests and the bookmarklet.
import { VoicePilot, HeadsetSession, jevViaProxy, norm, inSeason } from '../voicePilot';
import { ClipSpeaker, planClips } from '../clipSpeaker';
import { HQS_ITEMS, HQS_PHRASES, HQS_RETIRED, translateHqs } from '../hqsCrosswalk';
(window as any).VoicePilotLib = { VoicePilot, HeadsetSession, jevViaProxy, norm, inSeason, ClipSpeaker, planClips, HQS: { HQS_ITEMS, HQS_PHRASES, HQS_RETIRED, translateHqs } };
