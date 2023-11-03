import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { GameMoves } from './game-moves.entity';

@Entity('games')
export class GameSessions {
    @PrimaryColumn()
    public id: string;

    @CreateDateColumn()
    public created_at?: Date;

    @UpdateDateColumn()
    public updated_at?: Date;

    @Column()
    public playerOne: string;

    @Column({ nullable: true })
    public playerTwo: string;

    @OneToMany(() => GameMoves, ({ gameSession }) => gameSession)
    public gameMoves: GameMoves[];
}