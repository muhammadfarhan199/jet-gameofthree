import { Injectable } from '@nestjs/common';
import { GameSession } from 'src/game/interfaces/game.interface';

/**
 * This service mimics as an active datastore e.g. redis - for speedy performant operations
 */
@Injectable()
export class GameCacheService {

    constructor() { }

    private pendingPlayers: Map<string, GameSession> = new Map<string, GameSession>();
    private currentGames: Map<string, GameSession> = new Map<string, GameSession>();
    private clientSessionMappings: Map<string, string> = new Map<string, string>();

    /**
     * Adds a new game session to pendingPlayers hashmap
     * @param gameSession gameSession
     * @param clientId clientId
     */
    public addGameSession(gameSession: GameSession, clientId: string) {
        this.pendingPlayers.set(gameSession.sessionId, gameSession);
        this.clientSessionMappings.set(clientId, gameSession.sessionId);
    }

    /**
     * Returns hashmap for pendingPlayers
     * @returns 
     */
    public getPendingPlayers(): Map<string, GameSession> {
        return this.pendingPlayers;
    }

    /**
     * 
     * @returns Returns hashmap for currentGames
     */
    public getCurrentGames(): Map<string, GameSession> {
        return this.currentGames;
    }

    /**
     * Moves pending session to currentGames session
     * @param gameSession gameSession
     * @param clientId clientId
     */
    public consolidateGameSession(gameSession: GameSession, clientId: string): void {
        this.currentGames.set(gameSession.sessionId, gameSession);
        this.pendingPlayers.delete(gameSession.sessionId);
        this.clientSessionMappings.set(clientId, gameSession.sessionId);
    }

    /**
     * Removes all data of clients and games from hashMaps for a given game session
     * @param gameSession gameSession
     */
    public cleanGameMappings(gameSession: GameSession): void {
        this.currentGames.delete(gameSession.sessionId);
        this.clientSessionMappings.delete(gameSession.playerOne);
        this.clientSessionMappings.delete(gameSession?.playerTwo);
    }

    /**
     * Updates current game data into hashmap
     * @param gameSession gameSession
     */
    public setCurrentGame(gameSession: GameSession): void {
        this.currentGames.set(gameSession.sessionId, gameSession);
    }

    /**
     * Returns gameSession information by client details
     * @param clientId clientId
     * @returns returns GamesSession information from hashmaps
     */
    public identifySessionByClient(clientId: string): GameSession {
        // check if this client was actively playing
        const clientPlayedGame = this.clientSessionMappings.get(clientId);
        
        if (clientPlayedGame && this.currentGames.has(clientPlayedGame)) {
            // get game information
            return this.currentGames.get(clientPlayedGame);
        }

        return null;
    }

}
