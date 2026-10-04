import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import VoiceSetup from '../../VoiceSetup';
import { HeadsetSession } from '../../voicePilot';
const session = new HeadsetSession();
(window as any).__session = session;
function App() {
  const [result, setResult] = useState<any>(undefined);
  return result === undefined ? <VoiceSetup session={session} onClose={r => { setResult(r); (window as any).__result = r; }} /> : <pre id="result">{JSON.stringify(result)}</pre>;
}
createRoot(document.getElementById('root')!).render(<App />);
