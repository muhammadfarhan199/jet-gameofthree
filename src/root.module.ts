import { Module } from '@nestjs/common';
import { GatewayModule } from './gateway/gateway.module';
import { GameModule } from './game/game.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameSessions } from './game/models/game-session.entity';
import { GameMoves } from './game/models/game-moves.entity';

@Module({
  imports: [
    GatewayModule, 
    GameModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.HOST,
      port: parseInt(process.env.PORT),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      entities: [GameSessions, GameMoves],
      database: process.env.POSTGRES_DATABASE,
      synchronize: true,
      logging: false
    })
  ],
  controllers: [],
  providers: [],
})
export class RootModule {}
