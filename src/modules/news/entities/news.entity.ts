import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('news')
export class News {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column('text', { nullable: true })
  title: string;

  @Column({ nullable: true })
  created_at: number;

  @Column({ nullable: true })
  content: string;
}
