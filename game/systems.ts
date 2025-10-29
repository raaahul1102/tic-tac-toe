import { metadata } from "lib/metadata.ts"
import type { MessageRegistry, Messages, UpdateColors, PlayerProfile } from "game/messages.d.ts"
import type { Line, SquarePosition } from "game/board.d.ts"
import type { ServerWorld } from "game/world.server.ts"
import { Player } from "game/player.ts"

export const markerSystemServer: System<"server"> = {
    onMark(marked, world) {
        const player = Player.get(marked)
        if (!player) return Player.notFound("Mark", marked)

        const { place } = marked

        if (
            player.state.connection !== "ingame" ||
            world.state.connection !== "ingame" ||
            player.state.sign !== world.state.turn
        ) {
            return
        }

        const { board } = world.state

        const currentlyUnmarked = board[place - 1] === null

        if (currentlyUnmarked) {
            board[place - 1] = player.state.sign
            return world.update("Switch")
        }
    }
}

const lines = [
    [ 1, 2, 3 ],
    [ 4, 5, 6 ],
    [ 7, 8, 9 ],
    [ 1, 4, 7 ],
    [ 2, 5, 8 ],
    [ 3, 6, 9 ],
    [ 3, 5, 7 ],
    [ 1, 5, 9 ]
] as const

export const lineCheckSystem: System<"server"> = {
    onMark(_, world) {
        if (world.state.connection !== "ingame") return
        
        const { board } = world.state

        const markedWithX = new Array<SquarePosition>
        const markedWithO = new Array<SquarePosition>

        let markedPlaces = 0

        for (let place = 1; place <=9; place++) {
            const marked = board[place - 1]
            if (marked !== null) {
                if (marked === "X") markedWithX.push(place as SquarePosition)
                if (marked === "O") markedWithO.push(place as SquarePosition)
                if (marked !== undefined) markedPlaces++
            }
        }

        for (const line of lines) {
            let winningSign: "X" | "O" | undefined = undefined
            if (makesLine(line, markedWithX)) winningSign = "X"
            if (makesLine(line, markedWithO)) winningSign = "O"
            if (winningSign !== undefined) {
                return world.channel.send("Victory", { winningSign, line })
            }
        }

        if (markedPlaces === 9) {
            world.channel.send("Draw")
        }
    }
}

function makesLine(line: Line, board: Array<SquarePosition>) {
    if (board.includes(line[0]) && board.includes(line[1]) && board.includes(line[2])) return true
    return false
}

export const turnSystemServer: System<"server"> = {
    onSwitch(data, world) {
        if (world.state.connection === "ingame") {
            const to = data.to ?? world.state.turn === "X" ? "O" : "X"
            world.state = {
                ...world.state,
                turn: to
            }
        }
    }
}

export const gameLoopSystemServer: System<"server"> = {
    onReady(_, world) {
        const { players } = world

        const signs: ("X" | "O")[] = Math.random() < 0.5 ? ["X", "O"] : ["O", "X"]
        const firstTurn = Math.random() < 0.5 ? "X" : "O"
        world.state = {
            connection: "ingame",
            board: [ null, null, null, null, null, null, null, null, null ],
            turn: firstTurn
        }

        const participatingPlayers: [Player, "X" | "O"][] = []

        for (const player of players) {
            if (player.state.connection === "inworld") {
                const sign = signs.pop()!
                participatingPlayers.push([player, sign])
            }
        }

        if (participatingPlayers.length === 2) {
            const [
                [player1, sign1],
                [player2, sign2]
            ] = participatingPlayers

            const player1Name = player1.state.connection === "inworld" ? player1.state.name : undefined
            const player2Name = player2.state.connection === "inworld" ? player2.state.name : undefined

            player1.state = { connection: "ingame", name: player1Name, sign: sign1 }
            player2.state = { connection: "ingame", name: player2Name, sign: sign2 }

            player1.send("Start", {
                turn: firstTurn,
                sign: sign1,
                opponent: { name: player2Name, sign: sign2 }
            })
            player2.send("Start", {
                turn: firstTurn,
                sign: sign2,
                opponent: { name: player1Name, sign: sign1 }
            })
        }
    },
    onRequestRematch(data, world) {
        const { players } = world
        const requestingPlayer = Player.get(data)
        if (requestingPlayer === undefined) return Player.notFound("RequestRematch", data)
        if (requestingPlayer.state.connection !== "ingame") return

        requestingPlayer.state = {
            ...requestingPlayer.state,
            connection: "inworld"
        }

        if (players.size === 2 && Array.from(players).every(p => p.state.connection === "inworld")) {
            return world.update("Ready")
        }
        for (const player of players) {
            if (player === requestingPlayer) continue
            player.send("RematchRequested")
        }
    }
}

const colors = metadata<UpdateColors>()

export const colorSystemServer: System<"server"> = {
    onAddPlayer({ player }, world) {
        const UpdateColors = colors.get(world)
        if (UpdateColors !== undefined) {
            player.send("UpdateColors", UpdateColors)
        }
    },
    onUpdateColors(color, world) {
        colors.set(world, color)
        world.channel.send("UpdateColors", color)
    }
}

export const syncSystemServer: System<"server"> = {
    onMark(_, world) {
        if (world.state.connection === "ingame") {
            world.channel.send("Sync", {
                board: world.state.board,
                turn: world.state.turn
            })
        }
    }
}

export const connectionSystemServer: System<"server"> = {
    onAddPlayer({ player }, world) {
        const { players, name } = world
        if (players.has(player)) return

        if (player.state.connection !== "connected") {
            return
        }

        if (players.size < 2) {
            players.add(player)
            player.state = {
                connection: "inworld",
                name: undefined
            }
            player.send("JoinedWorld", {
                world: name,
                player: {
                    name: undefined
                }
            })
            if (players.size === 2 && Array.from(players).every(p => p.state.connection === "inworld")) {
                world.update("Ready")
            }
            /** subscribe the world to the message being sent by the player */
            player.subscribe(world)
        } else {
            player.send("WorldOccupied", { world: name })
        }
    },
    onDisconnected({ player }: { player?: Player }, world: ServerWorld) {
        if (player && player.state.connection === "ingame") {
            world.players.delete(player)
            world.channel.send("Disconnected", { player })
        }
    }
}

export const profileSystemServer: System<"server"> = {
    onAddPlayer({ player }, world) {
        const profile = playerProfiles.get(world)?.get(player.id)
        if (profile !== undefined) {
            player.send("PlayerProfile", profile)
        }
    },
    onPlayerProfile(profile, world) {
        const player = Player.get(profile)
        if (!player) return Player.notFound("PlayerProfile", profile)

        let profiles = playerProfiles.get(world)
        if (!profiles) {
            profiles = new Map()
            playerProfiles.set(world, profiles)
        }
        profiles.set(player.id, profile)

        // Broadcast to other players only
        for (const otherPlayer of world.players) {
            if (otherPlayer !== player) {
                otherPlayer.send("OpponentProfile", profile)
            }
        }
    }
}

const playerProfiles = metadata<Map<string, PlayerProfile>>()

export type System<RunsOn extends "server" = "server"> = {
    [M in `on${Messages}`]?: (
        data: MessageRegistry[RemoveOn<M>],
        world: ServerWorld
    ) => unknown
}
type RemoveOn<S extends string> =
    S extends `on${infer T}` ? T : S
