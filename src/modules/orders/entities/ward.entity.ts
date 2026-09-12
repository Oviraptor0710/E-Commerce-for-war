import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Province } from './province.entity';
import { Address } from './address.entity';

@Entity('Wards')
export class Ward {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column()
  name: string;

  @Column({ type: 'bigint' })
  province_id: string;

  @ManyToOne(() => Province, (province) => province.wards, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'province_id',
    foreignKeyConstraintName: 'fk_wards_province',
  })
  province: Province;

  @OneToMany(() => Address, (address) => address.ward)
  addresses: Address[];

}
