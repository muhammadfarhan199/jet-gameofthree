import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from './game.service';
import { WebSocketGatwayService } from '../gateway/gateway.service';
import { GameCacheService } from './game-cache.service';
import { GameRepository } from './repository/game.repository';
import { GameSession } from './interfaces/game.interface';

jest.mock('uuid', () => ({ v4: () => '123456789' }));
jest.useFakeTimers();

describe('GameService', () => {

    let gameService: GameService;
    let gameCacheService: GameCacheService;
    let gameRepository: GameRepository;

    const webSocketGatwayServiceMock = { emitEventToClient: jest.fn() };
    const gameCacheServiceMock = {
        getPendingPlayers: jest.fn(),
        addGameSession: jest.fn(),
        setCurrentGame: jest.fn(),
        getCurrentGames: jest.fn(),
        identifySessionByClient: jest.fn(),
        consolidateGameSession: jest.fn(),
        cleanGameMappings: jest.fn()
    };
    const gameRepositoryMock = { updateGameSession: jest.fn(), addGameSession: jest.fn(), addGameMove: jest.fn() };

    beforeEach(async () => {

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameService,
                {
                    provide: WebSocketGatwayService,
                    useValue: webSocketGatwayServiceMock,
                },
                {
                    provide: GameCacheService,
                    useValue: gameCacheServiceMock,
                },
                {
                    provide: GameRepository,
                    useValue: gameRepositoryMock,
                },
            ],
        }).compile();

        gameService = module.get<GameService>(GameService);
        gameCacheService = module.get<GameCacheService>(GameCacheService);
        gameRepository = module.get<GameRepository>(GameRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(gameService).toBeDefined();
        expect(gameCacheService).toBeDefined();
        expect(gameRepository).toBeDefined();
    });

    it('should start a new game session when no pending players exist', async () => {
        const clientId = 'someClientId';
        const gameSessionCreated: GameSession = {
            sessionId: '123456789',
            playerOne: clientId,
        };

        jest.spyOn(gameCacheServiceMock, 'getPendingPlayers').mockReturnValue(new Map());
        jest.spyOn(gameCacheServiceMock, 'addGameSession').mockImplementation();
        jest.spyOn(gameRepositoryMock, 'addGameSession').mockImplementation();
        jest.spyOn(webSocketGatwayServiceMock, 'emitEventToClient').mockImplementation();

        const gameSession = await gameService.startGame(clientId);

        expect(gameSession).toEqual(gameSessionCreated);
        expect(gameCacheServiceMock.addGameSession).toHaveBeenCalledWith(
            gameSessionCreated,
            clientId
        );
        expect(gameRepositoryMock.addGameSession).toHaveBeenCalledWith(gameSessionCreated);
        expect(webSocketGatwayServiceMock.emitEventToClient).toHaveBeenCalledWith(
            clientId,
            'gameOfThree',
            { message: 'Waiting for opponent to join the game.' }
        );
    });

    it('should join an existing game session when a pending player exists', async () => {
        const clientId = 'someClientId';
        const pendingClientId = 'pendingClientId';
        const gameSession: GameSession = {
            sessionId: '123456789',
            playerOne: pendingClientId, // An existing game session with a pending player
        };

        const pendingPlayers = new Map([[gameSession.sessionId, gameSession]]);

        jest.spyOn(gameCacheServiceMock, 'getPendingPlayers').mockReturnValue(pendingPlayers);
        jest.spyOn(gameRepositoryMock, 'updateGameSession').mockImplementation();
        jest.spyOn(webSocketGatwayServiceMock, 'emitEventToClient').mockImplementation();

        const joinedGameSession = await gameService.startGame(clientId);

        expect(joinedGameSession).toEqual(gameSession);
        expect(gameCacheServiceMock.consolidateGameSession).toHaveBeenCalledWith(
            gameSession,
            clientId
        );
        expect(gameRepositoryMock.updateGameSession).toHaveBeenCalledWith(gameSession);
        expect(webSocketGatwayServiceMock.emitEventToClient).toHaveBeenCalledWith(
            pendingClientId,
            'gameOfThree',
            { "message": `You are now playing against ${clientId}. Please start the game.` }
        );
        expect(webSocketGatwayServiceMock.emitEventToClient).toHaveBeenCalledWith(
            clientId,
            'gameOfThree',
            { "message": `You are now playing against ${pendingClientId}. Waiting for their move.` }
        );
    });

    it('should perform a game move when a game session exists', async () => {
        const clientId = 'someClientId';
        const clientIdTwo = 'clientIdTwo';
        const gameSession: GameSession = {
            sessionId: '123456789',
            playerOne: clientId,
            playerTwo: clientIdTwo,
            gameMoves: [{ generatedNumber: 5, playerId: clientId }],
        };

        const currentGames = new Map([[gameSession.sessionId, gameSession]]);

        jest.spyOn(gameCacheServiceMock, 'getCurrentGames').mockReturnValue(currentGames);
        jest.spyOn(gameCacheServiceMock, 'identifySessionByClient').mockReturnValue(gameSession);
        jest.spyOn(gameRepositoryMock, 'addGameMove').mockImplementation();
        jest.spyOn(webSocketGatwayServiceMock, 'emitEventToClient').mockImplementation();

        const gameSessionUpdated = await gameService.performGameMove(clientIdTwo);

        expect(gameSessionUpdated).toEqual(gameSession);
        expect(gameRepositoryMock.addGameMove).toHaveBeenCalled();
        expect(webSocketGatwayServiceMock.emitEventToClient).toHaveBeenCalledWith(
            clientIdTwo,
            'gameOfThree',
            { "message": `You have performed '1' and resulting number is 2. Waiting for the opponent to make their move.` }
        );
        expect(webSocketGatwayServiceMock.emitEventToClient).toHaveBeenCalledWith(
            gameSession.playerOne,
            'gameOfThree',
            { "message": `Opponent has performed '1' and resulting number is 2. It's your turn to make a move now.` }
        );
    });

    it('should perform a game move and determine a win', async () => {
        const clientId = 'someClientId';
        const opponentClientId = 'opponentClientId';
        const gameSession: GameSession = {
            sessionId: '123456789',
            playerOne: clientId,
            playerTwo: opponentClientId,
            gameMoves: [
                { generatedNumber: 6, playerId: clientId },
                { generatedNumber: 2, playerId: opponentClientId },
            ],
        };

        const currentGames = new Map([[gameSession.sessionId, gameSession]]);

        jest.spyOn(gameCacheServiceMock, 'getCurrentGames').mockReturnValue(currentGames);
        jest.spyOn(gameCacheServiceMock, 'identifySessionByClient').mockReturnValue(gameSession);
        jest.spyOn(gameRepositoryMock, 'addGameMove').mockImplementation();
        jest.spyOn(webSocketGatwayServiceMock, 'emitEventToClient').mockImplementation();

        const gameSessionUpdated = await gameService.performGameMove(clientId);

        expect(gameSessionUpdated).toEqual(gameSession);
        expect(gameRepositoryMock.addGameMove).toHaveBeenCalled();
        expect(webSocketGatwayServiceMock.emitEventToClient).toHaveBeenCalledWith(
            clientId,
            'gameOfThree',
            { "message": `You have performed '1' and resulting number is 1. Waiting for the opponent to make their move.` }
        );
        expect(webSocketGatwayServiceMock.emitEventToClient).toHaveBeenCalledWith(
            opponentClientId,
            'gameOfThree',
            { "message": `Opponent has performed '1' and resulting number is 1. ` }
        );
        expect(webSocketGatwayServiceMock.emitEventToClient).toHaveBeenCalledWith(
            clientId,
            'gameOfThree',
            { "message": 'Congratulations! You have won the game. Hit move to start a new game.' }
        );
    });

    it('should identify client disconnect and inform the other player', () => {
        const clientId = 'someClientId';
        const gameSession: GameSession = {
            sessionId: '123456789',
            playerOne: clientId,
            playerTwo: 'opponentClientId',
        };

        jest.spyOn(gameCacheServiceMock, 'identifySessionByClient').mockReturnValue(gameSession);
        jest.spyOn(gameCacheServiceMock, 'cleanGameMappings').mockImplementation();
        jest.spyOn(webSocketGatwayServiceMock, 'emitEventToClient').mockImplementation();

        gameService.identifyClientDisconnectAndNotify(clientId);

        expect(gameCacheServiceMock.cleanGameMappings).toHaveBeenCalledWith(gameSession);
        expect(webSocketGatwayServiceMock.emitEventToClient).toHaveBeenCalledWith(
            'opponentClientId',
            'gameOfThree',
            { "message": 'Opponent disconnected. You have won the game. Hit move to start a new game.' }
        );
    });

});