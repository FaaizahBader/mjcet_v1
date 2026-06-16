const PREFERRED_VOICE_LANGS = ['en-US', 'en-GB', 'en-AU']
const PREFERRED_VOICE_NAMES = [
  'Google US English',
  'Google UK English Female',
  'Microsoft Aria',
  'Microsoft Jenny',
  'Microsoft Sonia',
  'Samantha',
]

function getPreferredVoice() {
  const voices = window.speechSynthesis?.getVoices?.() ?? []

  for (const preferredName of PREFERRED_VOICE_NAMES) {
    const voice = voices.find((item) =>
      item.name.toLowerCase().includes(preferredName.toLowerCase()),
    )
    if (voice) return voice
  }

  return (
    voices.find((voice) => PREFERRED_VOICE_LANGS.includes(voice.lang)) ??
    voices.find((voice) => voice.lang?.startsWith('en-')) ??
    null
  )
}

function normalizeSpeechText(text) {
  return text
    .replace(/\bLR\b/g, 'Ladies Room')
    .replace(/\b(\d+(?:\.\d+)?)\s*m\b/gi, '$1 meters')
    .replace(/\b(\d+(?:\.\d+)?)\s*km\b/gi, '$1 kilometers')
    .replace(/\b(\d+)\s*min\b/gi, '$1 minutes')
}

function createUtterance(text) {
  const utterance = new SpeechSynthesisUtterance(normalizeSpeechText(text))
  const voice = getPreferredVoice()

  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = 'en-US'
  }

  utterance.rate = 0.88
  utterance.pitch = 1
  return utterance
}

export function speak(text) {
  if (!window.speechSynthesis) return

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(createUtterance(text))
}

export function speakSequence(lines, delayMs = 1100) {
  if (!window.speechSynthesis || !lines?.length) return

  window.speechSynthesis.cancel()

  let index = 0
  const speakNext = () => {
    if (index >= lines.length) return

    const utterance = createUtterance(lines[index])
    index += 1
    utterance.onend = () => {
      window.setTimeout(speakNext, delayMs)
    }
    utterance.onerror = () => {
      window.setTimeout(speakNext, delayMs)
    }
    window.speechSynthesis.speak(utterance)
  }

  speakNext()
}

export function confirmNavigation(label) {
  speak(`Route ready for ${label}. Tap Start Route to begin navigation.`)
}

export function announceNotFound() {
  speak('Destination not found.')
}

export function announceNavigationStart(label) {
  speak(`Starting walking navigation to ${label}.`)
}

export function announceInstruction(instruction) {
  if (!instruction) return
  speak(instruction)
}

export function announceInstructionSequence(instructions) {
  speakSequence(instructions)
}

export function announceReroute() {
  speak('Rerouting from your current location.')
}

export function announceArrival(label) {
  speak(`You have arrived at ${label}.`)
}
