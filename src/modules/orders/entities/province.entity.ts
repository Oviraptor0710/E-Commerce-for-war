import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Ward } from './ward.entity';

@Entity('Provinces')
export class Province {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column()
  name: string;

  @OneToMany(() => Ward, (ward) => ward.province)
  wards: Ward[];
}
