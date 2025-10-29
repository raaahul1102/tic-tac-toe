import { WebSocketServer, WebSocket as WSWebSocket } from "ws"
import * as http from "http"
import { lobby } from "./game/lobby"

type EventListener = ((event: Event) => void) | { handleEvent(event: Event): void }

interface ListenerInfo {
    listener: EventListener
    once?: boolean
}

// Adapter to convert ws library WebSocket to browser-like WebSocket API
class WebSocketAdapter {
    private ws: WSWebSocket
    private listeners: Map<string, Set<ListenerInfo>> = new Map()
    
    constructor(ws: WSWebSocket) {
        this.ws = ws
        this.setupEventForwarding()
    }
    
    get readyState(): number {
        return this.ws.readyState
    }
    
    send(data: string): void {
        this.ws.send(data)
    }
    
    addEventListener(type: string, listener: EventListener, options?: { once?: boolean }): void {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set())
        }
        this.listeners.get(type)!.add({ 
            listener, 
            once: options?.once 
        })
    }
    
    removeEventListener(type: string, listener: EventListener): void {
        const listeners = this.listeners.get(type)
        if (listeners) {
            for (const info of Array.from(listeners)) {
                if (info.listener === listener) {
                    listeners.delete(info)
                    break
                }
            }
        }
    }
    
    private setupEventForwarding(): void {
        // Map Node.js events to DOM-like events
        if (this.ws.readyState === WSWebSocket.OPEN) {
            // Already open, dispatch immediately
            setTimeout(() => {
                this.dispatchEvent({ type: "open", target: this } as unknown as Event)
            }, 0)
        } else {
            this.ws.on("open", () => {
                this.dispatchEvent({ type: "open", target: this } as unknown as Event)
            })
        }
        
        this.ws.on("message", (data: Buffer) => {
            this.dispatchEvent({ 
                type: "message", 
                target: this,
                data: data.toString()
            } as unknown as MessageEvent)
        })
        
        this.ws.on("close", () => {
            this.dispatchEvent({ type: "close", target: this } as unknown as Event)
        })
    }
    
    private dispatchEvent(event: Event): void {
        const listenerInfos = this.listeners.get(event.type)
        if (listenerInfos) {
            const onceListeners: ListenerInfo[] = []
            for (const info of Array.from(listenerInfos)) {
                try {
                    // Support both function listeners and EventTarget objects
                    if (typeof info.listener === "function") {
                        info.listener(event)
                    } else if (info.listener && typeof info.listener.handleEvent === "function") {
                        info.listener.handleEvent(event)
                    }
                } catch (e) {
                    console.error("Error in event listener:", e)
                }
                if (info.once) {
                    onceListeners.push(info)
                }
            }
            onceListeners.forEach(info => listenerInfos.delete(info))
        }
    }
}

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4321
const HOST = process.env.HOST || (process.env.NODE_ENV === "development" ? "0.0.0.0" : "127.0.0.1")

const server = http.createServer()
const wss = new WebSocketServer({ 
    server,
    path: "/connect"
})

wss.on("connection", (ws: WSWebSocket) => {
    // Wrap ws library WebSocket in adapter for browser-like API
    const adapted = new WebSocketAdapter(ws) as any as WebSocket
    lobby.enter(adapted)
})

server.listen(PORT, HOST, () => {
    console.log(`WebSocket server running on ws://${HOST}:${PORT}/connect`)
})
