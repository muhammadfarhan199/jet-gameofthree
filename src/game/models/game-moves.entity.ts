import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { GameSessions } from './game-session.entity';

@Entity('gameMoves')
export class GameMoves {
    @PrimaryGeneratedColumn('uuid')
    public id: string;

    @CreateDateColumn()
    public created_at?: Date;

    @Column()
    public player_id: string;

    @Column()
    public generated_number: number;

    @Column({ nullable: true })
    public move_performed: number;

    @ManyToOne(() => GameSessions, ({ gameMoves }) => gameMoves)
    public gameSession: GameSessions;
}