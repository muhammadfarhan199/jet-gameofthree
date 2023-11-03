export interface GameSession {
    sessionId: string;
    playerOne: string;
    playerTwo?: string;
    gameMoves?: GameMove[];
}

export interface GameMove {
    playerId: string;
    generatedNumber: number;
    movePerformed?: number;
}