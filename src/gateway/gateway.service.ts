import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from '../game/game.service';
import { GameSession } from '../game/interfaces/game.interface';
import { GAME_EVENT_TOPIC } from '../game/constants/index';

@WebSocketGateway()
@Injectable()
export class WebSocketGatwayService implements OnGatewayConnection, OnGatewayDisconnect {
    public constructor(
        @Inject(forwardRef(() => GameService))
        private readonly gameService: GameService
    ) { }

    @WebSocketServer()
    private server: Server;

    /**
     * For simplicity, clients are populated here. Otherwise ideally these clients will also be maintained in an active db redis
     */
    private clients = new Map<string, Socket>();

    /**
     * Handles new client connection on socket
     * @param client client
     */
    public async handleConnection(client: Socket): Promise<void> {
        try {
            // Store the client's information when they connect
            this.clients.set(client.id, client);

            Logger.log(`${client.id} has connected.`);

            // trigger game start
            await this.gameService.startGame(client.id);
        }
        catch (e) {
            Logger.log('Something went wrong!');
            client.emit(GAME_EVENT_TOPIC, { message: 'Unfortunately game has stopped. Please start a new game.' });
        }
    }

    /**
     * Handles client disconnections on socket
     * @param client client
     */
    public handleDisconnect(client: Socket): void {
        try {
            // Remove the client from the map when they disconnect
            this.clients.delete(client.id);

            // if this client was actively playing a game then identify game users
            this.gameService.identifyClientDisconnectAndNotify(client.id);
        }
        catch (e) {
            Logger.log('Something went wrong!');
            client.emit(GAME_EVENT_TOPIC, { message: 'Unfortunately game has stopped. Please start a new game.' });
        }
    }

    /**
     * Emits event to specific clients
     * @param clientId clientId
     * @param eventName eventName
     * @param eventData eventData
     */
    public emitEventToClient(clientId: string, eventName: string, eventData: { message: string }): void {
        const client = this.clients.get(clientId);

        if (client) {
            // Send the event to the specific client
            client.emit(eventName, eventData);
        }
    }

    /**
     * Handles incoming events from clients
     * @param data data
     * @param client client
     */
    @SubscribeMessage('move')
    public async handleEvent(
        @MessageBody() data: GameSession,
        @ConnectedSocket() client: Socket
    ): Promise<void> {
        try {
            await this.gameService.performGameMove(client.id);
        }
        catch (e) {
            Logger.log('Something went wrong!');
            client.emit(GAME_EVENT_TOPIC, { message: 'Unfortunately game has stopped. Please start a new game.' });
            // notify other involved users about this problem and clear cache store
            this.gameService.identifyClientDisconnectAndNotify(client.id);
        }
    }
}