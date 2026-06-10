import Fuse from 'fuse.js'

const COMMAND_PREFIXES = [
  /^take me to (the )?/i,
  /^navigate to (the )?/i,
  /^go to (the )?/i,
  /^i want to go to (the )?/i,
  /^directions to (the )?/i,
]

export function normalizeSpokenText(text) {
  let normalized = text.trim().toLowerCase()

  for (const pattern of COMMAND_PREFIXES) {
    normalized = normalized.replace(pattern, '')
  }

  return normalized.trim()
}

export function createDestinationMatcher(destinations) {
  const fuse = new Fuse(destinations, {
    keys: ['label', 'id'],
    threshold: 0.4,
    ignoreLocation: true,
  })

  return (spokenText) => {
    const query = normalizeSpokenText(spokenText)
    if (!query) return null

    const results = fuse.search(query)
    return results[0]?.item ?? null
  }
}
