import { Module, forwardRef } from '@nestjs/common';
import { WebSocketGatwayService } from './gateway.service';
import { GameModule } from 'src/game/game.module';

@Module({
  imports: [
    forwardRef(() => GameModule)
  ],
  providers: [WebSocketGatwayService],
  exports: [WebSocketGatwayService]
})

export class GatewayModule {}
