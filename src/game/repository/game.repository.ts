import { BadRequestException, Injectable, NotAcceptableException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { GameSessions } from '../models/game-session.entity';
import { GameMoves } from '../models/game-moves.entity';
import { GameMove, GameSession } from '../interfaces/game.interface';


@Injectable()
export class GameRepository {

    public constructor(
        @InjectRepository(GameSessions) private readonly gameSessionsRepository: Repository<GameSessions>,
        @InjectRepository(GameMoves) private readonly gameMovesRepository: Repository<GameMoves>,
    ) { }

    /**
     * Gets the game session details from database by Id
     * @param id id
     * @returns returns gameSession object from database
     */
    public async getGameSession(id: string): Promise<GameSessions> {
        const item: GameSessions | null = await this.gameSessionsRepository.findOne({
            where: { id }
        });

        if (!item)
            throw new NotFoundException();

        return item;
    }

    /**
     * Adds gameSession object to databae from Session DTO
     * @param gameSessionDTO gameSessionDTO
     * @returns returns newly added game session object from database
     */
    public async addGameSession({ sessionId, playerOne }: GameSession): Promise<GameSessions> {
        return await this.gameSessionsRepository.save(
            this.gameSessionsRepository.create({
                id: sessionId,
                player_one: playerOne
            })
        ).catch(
            error => {
                throw new NotAcceptableException((error).toString());
            }
        );
    }

    /**
     * Updates the gameSession object in database with new details
     * @param gameSessionDTO gameSessionDTO
     * @returns returns updated game session object from database
     */
    public async updateGameSession({ sessionId, playerTwo }: GameSession): Promise<GameSessions> {
        const item = await this.getGameSession(sessionId);

        return await this.gameSessionsRepository.save({ ...item, player_two: playerTwo })
            .catch(
                error => {
                    throw new NotAcceptableException((error).toString());
                }
            );
    }

    /**
     * Add a new game move to the db and map it to an existing game session
     * @param gameSessionDTO gameSessionDTO
     * @param gameMoveDTO gameMoveDTO
     * @returns returns newly added game move from database
     */
    public async addGameMove({ sessionId }: GameSession, { playerId, generatedNumber, movePerformed = null }: GameMove): Promise<GameMoves> {
        const currentGameSession = await this.getGameSession(sessionId);

        return await this.gameMovesRepository.save(
            this.gameMovesRepository.create({
                player_id: playerId,
                generated_number: generatedNumber,
                move_performed: movePerformed,
                gameSession: currentGameSession
            })
        ).catch(
            error => {
                throw new NotAcceptableException((error).toString());
            }
        );
    }
}