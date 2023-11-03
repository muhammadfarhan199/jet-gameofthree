import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { GameSessions } from './game-session.entity';

@Entity('gameMoves')
export class GameMoves {
    @PrimaryGeneratedColumn('uuid')
    public id: string;

    @CreateDateColumn()
    public created_at?: Date;

    @Column()
    public playerId: string;

    @Column()
    public generatedNumber: number;

    @Column({ nullable: true })
    public movePerformed: number;

    @ManyToOne(() => GameSessions, ({ gameMoves }) => gameMoves)
    public gameSession: GameSessions;
}