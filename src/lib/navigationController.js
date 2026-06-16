import { getIndoorMap, getIndoorRoom, hasIndoorMap } from './indoorMaps'

const ROOM_NUMBER_PATTERN = /^\d{4}$/

export function parseRoomNumber(input) {
  const roomNumber = String(input).trim()
  if (!ROOM_NUMBER_PATTERN.test(roomNumber)) return null

  return {
    roomNumber,
    block: roomNumber[0],
    floor: roomNumber[1],
    room: roomNumber.slice(2),
  }
}

export function isRoomNumberInput(input) {
  return Boolean(parseRoomNumber(input))
}

export function blockDestinationId(block) {
  return `block_${block}`
}

export function createIndoorRequest(roomNumber) {
  const parsed = parseRoomNumber(roomNumber)
  if (!parsed) {
    return { ok: false, error: 'Enter a valid 4-digit room number.' }
  }

  if (parsed.floor !== '0') {
    return {
      ok: false,
      unavailableFloor: true,
      error: 'Indoor navigation for this floor is not available yet.',
    }
  }

  const indoorMap = getIndoorMap(parsed.block, parsed.floor)
  if (!indoorMap) {
    return {
      ok: false,
      error: `Indoor navigation for Block ${parsed.block} is not available yet.`,
    }
  }

  const room = getIndoorRoom(indoorMap, parsed.roomNumber)
  if (!room) {
    return {
      ok: false,
      error: `Room ${parsed.roomNumber} is not available on the indoor map yet.`,
    }
  }

  return {
    ok: true,
    request: {
      ...parsed,
      indoorMapId: indoorMap.id,
      outdoorDestinationId: blockDestinationId(parsed.block),
      roomNodeId: room.nodeId,
      roomLabel: room.label,
    },
  }
}

export function canPromptForIndoor(destination) {
  const blockMatch = destination?.id?.match(/^block_(\d+)$/)
  if (!blockMatch) return false

  return hasIndoorMap(blockMatch[1], '0')
}

export function getBlockFromDestination(destination) {
  return destination?.id?.match(/^block_(\d+)$/)?.[1] ?? null
}
