import { Module, forwardRef } from '@nestjs/common';
import { GameService } from './game.service';
import { GatewayModule } from 'src/gateway/gateway.module';
import { GameRepository } from './repository/game.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameMoves } from './models/game-moves.entity';
import { GameSessions } from './models/game-session.entity';
import { GameCacheService } from './game-cache.service';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
    imports: [
        forwardRef(() => GatewayModule),
        EventEmitterModule.forRoot(),
        TypeOrmModule.forFeature([GameSessions, GameMoves])
    ],
    providers: [GameRepository, GameService, GameCacheService],
    exports: [GameService],
})

export class GameModule {}
