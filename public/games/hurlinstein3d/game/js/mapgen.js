// TDD 4.2: generate one connected 16 by 16 room-and-corridor chunk
const chunkSize = 16;
const doorIndex = 8;

// D-11: half of the chunks get a second, smaller room joined to the main one
const secondRoomChance = 0.5;
const secondRoomMinSize = 4;
const secondRoomMaxSize = 6;
const secondRoomAttempts = 40;

function generateChunk() {
  const cells = new Uint8Array(chunkSize * chunkSize);
  cells.fill(1);

  const roomWidth = randomInteger(4, 8);
  const roomHeight = randomInteger(4, 8);
  const roomX = randomInteger(2, chunkSize - roomWidth - 2);
  const roomY = randomInteger(2, chunkSize - roomHeight - 2);
  const room = { x: roomX, y: roomY, width: roomWidth, height: roomHeight };
  const roomCenter = {
    x: roomX + roomWidth / 2,
    y: roomY + roomHeight / 2,
  };
  const roomCenterCellX = Math.floor(roomCenter.x);
  const roomCenterCellY = Math.floor(roomCenter.y);

  carveRectangle(cells, roomX, roomY, roomWidth, roomHeight);

  carveNorthCorridor(cells, room, roomCenterCellX, roomCenterCellY);
  carveSouthCorridor(cells, room, roomCenterCellX, roomCenterCellY);
  carveWestCorridor(cells, room, roomCenterCellX, roomCenterCellY);
  carveEastCorridor(cells, room, roomCenterCellX, roomCenterCellY);

  const secondRoom = maybeCarveSecondRoom(cells, room);
  if (secondRoom) {
    connectRooms(cells, room, secondRoom);
  }

  return { cells, room, roomCenter, secondRoom };
}

// D-11: rolls the second room, tries to place it clear of the main room and,
// when it fits, carves it. Returns the room or null.
function maybeCarveSecondRoom(cells, mainRoom) {
  if (Math.random() >= secondRoomChance) {
    return null;
  }

  const secondRoom = placeSecondRoom(mainRoom);
  if (!secondRoom) {
    return null;
  }

  carveRectangle(cells, secondRoom.x, secondRoom.y, secondRoom.width, secondRoom.height);
  return secondRoom;
}

// D-11: random 4 to 6 room, inside the two-cell margin, not sharing a cell with
// the main room. Gives up after a few tries when a big main room leaves no gap.
function placeSecondRoom(mainRoom) {
  for (let attempt = 0; attempt < secondRoomAttempts; attempt += 1) {
    const width = randomInteger(secondRoomMinSize, secondRoomMaxSize);
    const height = randomInteger(secondRoomMinSize, secondRoomMaxSize);
    const x = randomInteger(2, chunkSize - width - 2);
    const y = randomInteger(2, chunkSize - height - 2);
    const candidate = { x, y, width, height };
    if (!roomsShareCells(candidate, mainRoom)) {
      return candidate;
    }
  }
  return null;
}

function roomsShareCells(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// D-11: an L corridor between the two room centers, so the second room joins
// the rest of the chunk. Both centers sit inside their rooms, so the path only
// crosses interior cells.
function connectRooms(cells, firstRoom, secondRoom) {
  const firstCenterX = Math.floor(firstRoom.x + firstRoom.width / 2);
  const firstCenterY = Math.floor(firstRoom.y + firstRoom.height / 2);
  const secondCenterX = Math.floor(secondRoom.x + secondRoom.width / 2);
  const secondCenterY = Math.floor(secondRoom.y + secondRoom.height / 2);

  carveVertical(cells, secondCenterX, secondCenterY, firstCenterY);
  carveHorizontal(cells, secondCenterX, firstCenterX, firstCenterY);
}

function randomInteger(minimum, maximum) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function carveRectangle(cells, x, y, width, height) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      setAir(cells, column, row);
    }
  }
}

function carveNorthCorridor(cells, room, roomCenterX, roomCenterY) {
  const bendY = randomInteger(1, room.y - 1);
  carveVertical(cells, doorIndex, 0, bendY);
  carveHorizontal(cells, doorIndex, roomCenterX, bendY);
  carveVertical(cells, roomCenterX, bendY, roomCenterY);
}

function carveSouthCorridor(cells, room, roomCenterX, roomCenterY) {
  const bendY = randomInteger(room.y + room.height, chunkSize - 2);
  carveVertical(cells, doorIndex, chunkSize - 1, bendY);
  carveHorizontal(cells, doorIndex, roomCenterX, bendY);
  carveVertical(cells, roomCenterX, bendY, roomCenterY);
}

function carveWestCorridor(cells, room, roomCenterX, roomCenterY) {
  const bendX = randomInteger(1, room.x - 1);
  carveHorizontal(cells, 0, bendX, doorIndex);
  carveVertical(cells, bendX, doorIndex, roomCenterY);
  carveHorizontal(cells, bendX, roomCenterX, roomCenterY);
}

function carveEastCorridor(cells, room, roomCenterX, roomCenterY) {
  const bendX = randomInteger(room.x + room.width, chunkSize - 2);
  carveHorizontal(cells, chunkSize - 1, bendX, doorIndex);
  carveVertical(cells, bendX, doorIndex, roomCenterY);
  carveHorizontal(cells, bendX, roomCenterX, roomCenterY);
}

function carveHorizontal(cells, startX, endX, y) {
  const minimumX = Math.min(startX, endX);
  const maximumX = Math.max(startX, endX);
  for (let x = minimumX; x <= maximumX; x += 1) {
    setAir(cells, x, y);
  }
}

function carveVertical(cells, x, startY, endY) {
  const minimumY = Math.min(startY, endY);
  const maximumY = Math.max(startY, endY);
  for (let y = minimumY; y <= maximumY; y += 1) {
    setAir(cells, x, y);
  }
}

function setAir(cells, x, y) {
  cells[y * chunkSize + x] = 0;
}

function formatChunk(cells) {
  const rows = [];
  for (let y = 0; y < chunkSize; y += 1) {
    let row = "";
    for (let x = 0; x < chunkSize; x += 1) {
      row += cells[y * chunkSize + x] === 0 ? "." : "#";
    }
    rows.push(row);
  }
  return rows.join("\n");
}
