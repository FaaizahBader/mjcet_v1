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

export function hasIndoorMap(block, floor = '0') {
  return Boolean(getIndoorMap(block, floor))
}
