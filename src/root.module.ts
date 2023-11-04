import { Module } from '@nestjs/common';
import { GatewayModule } from './gateway/gateway.module';
import { GameModule } from './game/game.module';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { GameSessions } from './game/models/game-session.entity';
import { GameMoves } from './game/models/game-moves.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    GatewayModule,
    GameModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) =>
      ({
        type: 'postgres',
        host: configService.get<string>('HOST'),
        port: configService.get<number>('PORT'),
        username: configService.get<string>('POSTGRES_USER'),
        password: configService.get<string>('POSTGRES_PASSWORD'),
        database: configService.get<string>('POSTGRES_DATABASE'),
        synchronize: true,
        logging: false,
        entities: [GameSessions, GameMoves],
      } as TypeOrmModuleOptions),
      inject: [ConfigService],
    }),
    ConfigModule.forRoot({ cache: true })
  ],
  controllers: [],
  providers: [],
})
export class RootModule { }
