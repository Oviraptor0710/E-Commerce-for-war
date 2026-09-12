import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductVariant } from '../../products/entities/product_variant.entity';
import { OrderItem } from '../../orders/entities/order_item.entity';
import { User } from '../../users/entities/user.entity';
import { InventoryMovementType } from '../enums/inventory-movement-type.enum';

@Entity('inventory_movements')
@Index('UQ_inventory_movements_idempotency_key', ['idempotency_key'], {
  unique: true,
})
@Index('idx_inventory_movements_variant_history', [
  'variant_id',
  'created_at',
  'id',
])
@Index('idx_inventory_movements_order_item', ['order_item_id', 'type'])
@Check('chk_inventory_movements_quantity_non_zero', '`quantity_delta` <> 0')
@Check(
  'chk_inventory_movements_stock_before_non_negative',
  '`stock_before` >= 0',
)
@Check(
  'chk_inventory_movements_stock_after_non_negative',
  '`stock_after` >= 0',
)
@Check(
  'chk_inventory_movements_stock_equation',
  '`stock_after` = `stock_before` + `quantity_delta`',
)
export class InventoryMovement {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  variant_id: string;

  @Column({ type: 'bigint', nullable: true })
  order_item_id: string | null;

  @Column({ type: 'enum', enum: InventoryMovementType })
  type: InventoryMovementType;

  @Column('int')
  quantity_delta: number;

  @Column('int')
  stock_before: number;

  @Column('int')
  stock_after: number;

  @Column({ type: 'varchar', length: 150 })
  idempotency_key: string;

  @Column({ type: 'bigint', nullable: true })
  created_by: string | null;

  @Column('text', { nullable: true })
  reason: string | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => ProductVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'variant_id',
    foreignKeyConstraintName: 'fk_inventory_movements_variant',
  })
  variant: ProductVariant;

  @ManyToOne(() => OrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'order_item_id',
    foreignKeyConstraintName: 'fk_inventory_movements_order_item',
  })
  order_item: OrderItem;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'created_by',
    foreignKeyConstraintName: 'fk_inventory_movements_created_by',
  })
  creator: User;
}
