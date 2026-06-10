export function speak(text) {
  if (!window.speechSynthesis) return

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-IN'
  utterance.rate = 1
  window.speechSynthesis.speak(utterance)
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

export function announceReroute() {
  speak('Rerouting from your current location.')
}

export function announceArrival(label) {
  speak(`You have arrived at ${label}.`)
}
