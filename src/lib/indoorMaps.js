import { block1GroundFloor } from '../data/indoor/block1GroundFloor'

const indoorMaps = [block1GroundFloor]

export function getIndoorMap(block, floor = '0') {
  return indoorMaps.find(
    (map) => map.block === String(block) && map.floor === String(floor),
  )
}

export function getIndoorRoom(map, roomNumber) {
  return map?.rooms?.[String(roomNumber)] ?? null
}

export function getIndoorFacility(map, facilityId) {
  return map?.facilities?.[String(facilityId)] ?? null
}

function normalizeIndoorQuery(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ')
}

export function findIndoorDestinationByAlias(map, input) {
  if (!map) return null

  const query = normalizeIndoorQuery(input)
  if (!query) return null

  for (const [roomNumber, room] of Object.entries(map.rooms ?? {})) {
    const names = [roomNumber, `room ${roomNumber}`, room.label, ...(room.aliases ?? [])]
    if (names.some((name) => normalizeIndoorQuery(name) === query)) {
      return {
        kind: 'room',
        id: roomNumber,
        displayName: `${roomNumber} (${room.label})`,
        destination: room,
      }
    }
  }

  for (const [facilityId, facility] of Object.entries(map.facilities ?? {})) {
    const names = [facilityId, facility.label, ...(facility.aliases ?? [])]
    if (names.some((name) => normalizeIndoorQuery(name) === query)) {
      return {
        kind: 'facility',
        id: facilityId,
        displayName: facility.label,
        destination: facility,
      }
    }
  }

  return null
}

export function hasIndoorMap(block, floor = '0') {
  return Boolean(getIndoorMap(block, floor))
}
