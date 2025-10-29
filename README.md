# WebSocket Testing Guide

## Quick Start

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Server runs on:** `ws://localhost:4321/connect`

---

## Method 1: Postman (Recommended)

.

### Setup:
1. Open Postman
2. Create New → **WebSocket Request**
3. URL: `ws://localhost:4321/connect`
4. Click **Connect**

### Testing Flow:

**Client A (Tab 1) - Create Game:**
```json
{"NewWorld": {}}
```
Response: `{"JoinedWorld":{"world":"happy-moon-123","player":{"animal":"🐱","name":null}}}`

**Client B (Tab 2) - Join Game:**
```json
{"JoinWorld":{"world":"happy-moon-123"}}
```
Both clients receive: `{"Start":{"opponent":{"animal":"🐰","sign":"O"},"sign":"X","turn":"X"}}`

**Client A - Make Move:**
```json
{"Mark":{"place":1}}
```
Both receive: `{"Sync":{"board":["X",null,null,null,null,null,null,null,null],"turn":"O"}}`

---

## Method 2: Command Line (wscat)

### Install wscat:
```bash
npm install -g wscat
```

### Connect:
```bash
wscat -c ws://localhost:4321/connect
```

### Send messages:
```
{"NewWorld": {}}
{"JoinWorld": {"world": "happy-moon-123"}}
{"Mark": {"place": 1}}
```

---

## Method 3: Browser Console

Open browser console and run:

```javascript
const ws = new WebSocket('ws://localhost:4321/connect')

ws.onopen = () => console.log('Connected!')
ws.onmessage = (event) => console.log('Received:', event.data)
ws.onerror = (error) => console.error('Error:', error)

// Send a message
ws.send(JSON.stringify({"NewWorld": {}}))
```

---

## Available Messages

### Client → Server:

1. **Create Game:**
   ```json
   {"NewWorld": {}}
   ```

2. **Join Game:**
   ```json
   {"JoinWorld": {"world": "game-name-here"}}
   ```

3. **Make Move:**
   ```json
   {"Mark": {"place": 1}}
   ```
   (Places: 1-9, left to right, top to bottom)

4. **Update Profile:**
   ```json
   {"PlayerProfile": {"name": "Alice", "animal": "🐱"}}
   ```

5. **Request Rematch:**
   ```json
   {"RequestRematch": {}}
   ```

### Server → Client:

- `JoinedWorld` - When you join/create a world
- `Start` - When game starts (2 players connected)
- `Sync` - Board state updates
- `Victory` - Game won
- `Draw` - Game tied
- `WorldNotFound` - Invalid world name
- `WorldOccupied` - World full (2 players already)

---

