import {
  findIndoorDestinationByAlias,
  getIndoorMap,
  getIndoorRoom,
  hasIndoorMap,
} from './indoorMaps'

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

export function findIndoorQuery(input) {
  const parsed = parseRoomNumber(input)
  if (parsed) return { type: 'roomNumber', parsed }

  const block1GroundFloor = getIndoorMap('1', '0')
  const aliasMatch = findIndoorDestinationByAlias(block1GroundFloor, input)
  if (!aliasMatch) return null

  return {
    type: 'alias',
    block: '1',
    floor: '0',
    aliasMatch,
  }
}

export function isIndoorDestinationInput(input) {
  return Boolean(findIndoorQuery(input))
}

export function blockDestinationId(block) {
  return `block_${block}`
}

export function createIndoorRequest(roomNumber) {
  const indoorQuery = findIndoorQuery(roomNumber)
  if (!indoorQuery) {
    return { ok: false, error: 'Enter a valid 4-digit room number.' }
  }

  if (indoorQuery.type === 'alias') {
    const indoorMap = getIndoorMap(indoorQuery.block, indoorQuery.floor)
    const { aliasMatch } = indoorQuery

    return {
      ok: true,
      request: {
        block: indoorQuery.block,
        floor: indoorQuery.floor,
        room: aliasMatch.id,
        roomNumber: aliasMatch.displayName,
        indoorMapId: indoorMap.id,
        outdoorDestinationId: blockDestinationId(indoorQuery.block),
        roomNodeId: aliasMatch.destination.nodeId,
        roomLabel: aliasMatch.destination.label,
      },
    }
  }

  const { parsed } = indoorQuery

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
      roomNumber: room.label
        ? `${parsed.roomNumber} (${room.label})`
        : parsed.roomNumber,
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
