import { Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketGatwayService } from '../gateway/gateway.service';
import { GameMove, GameSession } from '../game/interfaces/game.interface';
import { GameRepository } from './repository/game.repository';
import { GameCacheService } from './game-cache.service';
import { AI_PLAYER, AI_WAIT_TIME, CONSTANT_DIVIDEND, DIVIDE_OPERATIONS, GAME_BOT_TOPIC, GAME_EVENT_TOPIC } from './constants';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class GameService {

    constructor(
        @Inject(forwardRef(() => WebSocketGatwayService))
        private readonly webSocketGateway: WebSocketGatwayService,
        private readonly gameMappings: GameCacheService,
        private readonly gameRepository: GameRepository,
        private eventEmitter: EventEmitter2
    ) { }

    /**
     * Start game by adding players and creating session
     * @param clientId clientId
     * @returns returns newly created gameSession to players
     */
    public async startGame(clientId: string): Promise<GameSession> {
        const pendingPlayers = this.gameMappings.getPendingPlayers();

        // if there is already a pending player session then use the same session and assign both players
        if (pendingPlayers.size > 0) {
            const pendingGameSession: GameSession = pendingPlayers.values().next().value;

            // make sure this is not the same player
            if (pendingGameSession.playerOne === clientId) {
                this.emitClientEvent(
                    clientId,
                    'Please wait for other players to join. Otherwise an AI bot will start playing with you in a bit.'
                );
                Logger.log('Please wait for other players to join. Otherwise an AI bot will start playing with you in a bit.');
            } else {
                pendingGameSession.playerTwo = clientId;

                this.gameMappings.consolidateGameSession(pendingGameSession, clientId);

                // update db with complete game session object
                await this.gameRepository.updateGameSession(pendingGameSession);

                // now we emit events to both clients that game has started and who are they playing with

                // client 1 which has to start the game now
                this.emitClientEvent(
                    pendingGameSession.playerOne,
                    `You are now playing against ${pendingGameSession.playerTwo}. Please start the game.`
                );

                // client 2 which has to wait for the first move to happen
                this.emitClientEvent(
                    pendingGameSession.playerTwo,
                    `You are now playing against ${pendingGameSession.playerOne}. Waiting for their move.`
                );
            }

            return pendingGameSession;
        }

        // create a new session 
        const sessionId = uuidv4();

        const gameSession: GameSession = {
            sessionId,
            playerOne: clientId
        };

        this.gameMappings.addGameSession(gameSession, clientId);

        Logger.log('New Game has been initialized with SessionId => ', sessionId);

        // persist this new session in db as well
        await this.gameRepository.addGameSession(gameSession);

        // client 1 which has to start the game now
        this.emitClientEvent(
            gameSession.playerOne,
            'Waiting for opponent to join the game.'
        );

        // check game bot assigment
        this.eventEmitter.emit(
            GAME_BOT_TOPIC,
            sessionId
        );

        return gameSession;
    }

    /**
     * Simulates AI Bot for playing againt a real user
     * @param sessionId sessionId
     */
    private async simulateAIBot(sessionId: string): Promise<void> {
        const pendingPlayers = this.gameMappings.getPendingPlayers();

        // if no pending player session found then no need to check for pending game session
        if (!pendingPlayers.has(sessionId))
            return;

        const pendingGameSession: GameSession = pendingPlayers.get(sessionId);

        // Simulate a second player joining after 15 seconds
        const simulatedPlayerTwo = AI_PLAYER;
        pendingGameSession.playerTwo = simulatedPlayerTwo;

        this.gameMappings.consolidateGameSession(pendingGameSession, simulatedPlayerTwo);

        // update db with complete game session object
        await this.gameRepository.updateGameSession(pendingGameSession);

        // Inform player one about the automatic player two joining
        this.emitClientEvent(
            pendingGameSession.playerOne,
            'Automated player has joined the game. You can start playing.'
        );

        Logger.log('AI has connected to the game.');
    }

    /**
     * Perform a game move for an active session
     * @param clientId clientId
     * @returns returns updated gameSession object after making new moves
     */
    public async performGameMove(clientId: string): Promise<GameSession> {
        const currentGames = this.gameMappings.getCurrentGames();

        // get active game session by client ID
        const gameSession: GameSession = this.gameMappings.identifySessionByClient(clientId);

        // there is an active session going on
        if (gameSession && currentGames.has(gameSession.sessionId)) {
            // pick game session first
            const currentSession: GameSession = currentGames.get(gameSession.sessionId);

            if (currentSession?.gameMoves && currentSession?.gameMoves.length > 0) {
                // this means next move has to be by other player
                const lastMove = currentSession?.gameMoves[currentSession?.gameMoves.length - 1];

                // check if this is a valid move
                if (lastMove.playerId === clientId) {
                    Logger.log('Please wait for your opponent to make their move first.');

                    this.emitClientEvent(
                        clientId,
                        'Please wait for your opponent to make their move first.'
                    );

                    return currentSession;
                }

                // now we need to send this back to the other player
                let currentMove: GameMove = this.performDivisbleOperation({ ...lastMove });
                currentMove.playerId = clientId;

                Logger.log(`Current move performed by ${currentMove.playerId} is ${currentMove.movePerformed} and resulting number is ${currentMove.generatedNumber}.`);

                this.emitClientEvent(
                    currentMove.playerId,
                    `You have performed '${currentMove.movePerformed}' and resulting number is ${currentMove.generatedNumber}. Waiting for the opponent to make their move.`
                );

                this.emitClientEvent(
                    lastMove.playerId,
                    `Opponent has performed '${currentMove.movePerformed}' and resulting number is ${currentMove.generatedNumber}. ${currentMove.generatedNumber !== 1 ? 'It\'s your turn to make a move now.' : ''}`
                );

                // update mappings
                currentSession.gameMoves.push(currentMove);

                // persist game move in database
                await this.gameRepository.addGameMove(currentSession, currentMove);

                // check if this player won
                if (currentMove.generatedNumber === 1) {
                    // this player has won the game and we need to notify
                    Logger.log(`Player ${currentMove.playerId} has won the game.`);

                    // now we clear this from active games
                    this.gameMappings.cleanGameMappings(currentSession);

                    this.emitClientEvent(
                        currentMove.playerId,
                        'Congratulations! You have won the game. Hit move to start a new game.'
                    );
                    this.emitClientEvent(
                        lastMove.playerId,
                        'Opponent has won the game. Hit move to start a new game.'
                    );
                } else {
                    this.gameMappings.setCurrentGame(currentSession);
                }
            } else {
                // this has to be the first move
                const firstMove: GameMove = {
                    generatedNumber: this.getRandomPositiveWholeNumber(),
                    playerId: clientId
                }

                // now add this move to the list
                currentSession.gameMoves = [firstMove];

                // persist game move in database
                await this.gameRepository.addGameMove(currentSession, firstMove);

                this.emitClientEvent(
                    clientId,
                    `You have generated ${firstMove.generatedNumber}. Waiting for the opponent to make their move.`
                );

                this.emitClientEvent(
                    currentSession?.playerTwo,
                    `Opponent has generated ${firstMove.generatedNumber}. It's your turn to make a move now.`
                );

                this.gameMappings.setCurrentGame(currentSession);
                // this.currentGames.set(currentSession.sessionId, currentSession);

                Logger.log(`First move is performed by ${firstMove.playerId} and resulting number is ${firstMove.generatedNumber}`);
            }

            // Logic for AI automated response. recursively calls itself to make the next move
            // identify the players to handle AI vs user based responses
            if (currentGames.has(currentSession.sessionId) && currentSession.playerTwo === AI_PLAYER && clientId !== AI_PLAYER) {
                // this call is made by actual user, so that we can directly send response from here
                this.performGameMove(AI_PLAYER);
            }

            return currentSession;
        }

        // players have finished the game and want to play again
        return this.startGame(clientId);
    }

    /**
     * Identify if an active player disconnects during game session
     * @param clientId clientId
     */
    public identifyClientDisconnectAndNotify(clientId: string): void {
        const gameSession = this.gameMappings.identifySessionByClient(clientId);

        if (!gameSession) {
            return;
        }

        this.gameMappings.cleanGameMappings(gameSession);

        // inform other contestant that they have won the game
        const activePlayer: string = (clientId === gameSession.playerOne) ? gameSession.playerTwo : gameSession.playerOne;

        Logger.log(`Player ${clientId} has disconnected. Player ${activePlayer} has won the game.`);

        this.emitClientEvent(
            activePlayer,
            'Opponent disconnected. You have won the game. Hit move to start a new game.'
        );
    }

    /**
     * Emits event to given client using websocket
     * @param clientId clientId
     * @param message message
     */
    private emitClientEvent(clientId: string, message: string) {
        if (clientId !== AI_PLAYER) { // dont emit event to AI
            this.webSocketGateway.emitEventToClient(clientId, GAME_EVENT_TOPIC, { message });
        }
    }

    /**
     * Get a random whole number generated for a range
     * @param min min
     * @param max max
     * @returns returns a positive whole number between a given range
     */
    private getRandomPositiveWholeNumber(min: number = 3, max: number = 1000) {
        // only generating numbers upto 1000 to avoid 
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Perforn gameOfThree move on a given number
     * @param gameMove gameMove
     * @returns returns the move performed after appropriate operation
     */
    private performDivisbleOperation(gameMove: GameMove): GameMove {
        const validOperation: number = DIVIDE_OPERATIONS.find(
            operation => {
                const resultant = gameMove.generatedNumber + operation;

                return resultant % CONSTANT_DIVIDEND === 0;
            }
        );

        return {
            ...gameMove,
            generatedNumber: (gameMove.generatedNumber + validOperation) / CONSTANT_DIVIDEND,
            movePerformed: validOperation
        };
    }

    @OnEvent(GAME_BOT_TOPIC)
    private handleGameBotAssign(sessionId: string): void {
        // Set a timer for 15 seconds and initiate automated response by AI bot if no player two joins
        Logger.log(`Set a timer for 10 seconds and initiate automated response by AI bot if no player two joins`);

        setTimeout(async () => {
            await this.simulateAIBot(sessionId);
        }, AI_WAIT_TIME);
    }
}