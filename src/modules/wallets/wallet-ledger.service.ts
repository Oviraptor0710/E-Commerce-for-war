import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { WalletEntry } from './entities/wallet-entry.entity';
import { WalletOperation } from './entities/wallet-operation.entity';
import { WalletBalanceBucket } from './enums/wallet-balance-bucket.enum';
import { WalletEntryDirection } from './enums/wallet-entry-direction.enum';
import { WalletOperationStatus } from './enums/wallet-operation-status.enum';
import { WalletOperationType } from './enums/wallet-operation-type.enum';
import { WalletReferenceType } from './enums/wallet-reference-type.enum';
import { isCanonicalPositiveIntegerString } from '../../common/validation';

export interface WalletLedgerEntryInput {
  userId: string;
  bucket: WalletBalanceBucket;
  direction: WalletEntryDirection;
  amount: string | number;
}

export interface WalletLedgerOperationInput {
  type: WalletOperationType;
  referenceType: WalletReferenceType;
  referenceId?: number | string | null;
  idempotencyKey: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  reversesOperationId?: string | null;
  entries: WalletLedgerEntryInput[];
}

export interface WalletLedgerOperationResult {
  operation: WalletOperation;
  entries: WalletEntry[];
  replayed: boolean;
}

type AggregatedEntry = {
  userId: string;
  bucket: WalletBalanceBucket;
  delta: bigint;
};

@Injectable()
export class WalletLedgerService {
  constructor() {}

  async applyOperation(
    manager: EntityManager,
    input: WalletLedgerOperationInput,
  ): Promise<WalletLedgerOperationResult> {
    if (!input.idempotencyKey || input.idempotencyKey.length > 150) {
      throw new BadRequestException('Invalid wallet idempotency key.');
    }

    if (!input.entries.length) {
      throw new BadRequestException('A wallet operation must contain entries.');
    }

    const requestHash = this.hashRequest(input);
    const operationRepository = manager.getRepository(WalletOperation);

    // INSERT IGNORE makes the unique idempotency key the serialization point
    // when two requests for the same business operation arrive concurrently.
    await operationRepository
      .createQueryBuilder()
      .insert()
      .into(WalletOperation)
      .values({
        type: input.type,
        reference_type: input.referenceType,
        reference_id:
          input.referenceId === null || input.referenceId === undefined
            ? null
            : String(input.referenceId),
        idempotency_key: input.idempotencyKey,
        status: WalletOperationStatus.PENDING,
        reverses_operation_id: input.reversesOperationId ?? null,
        request_hash: requestHash,
        description: input.description ?? null,
        metadata: (input.metadata ?? null) as any,
        completed_at: null,
      })
      .orIgnore()
      .execute();

    const operation = await operationRepository
      .createQueryBuilder('operation')
      .where('operation.idempotency_key = :idempotencyKey', {
        idempotencyKey: input.idempotencyKey,
      })
      .setLock('pessimistic_write')
      .getOne();

    if (!operation) {
      throw new ConflictException('Wallet operation could not be created.');
    }

    if (operation.request_hash !== requestHash) {
      throw new ConflictException(
        'The idempotency key was already used with a different request.',
      );
    }

    if (
      input.type === WalletOperationType.REVERSAL &&
      (!operation.reverses_operation_id ||
        operation.reverses_operation_id === operation.id)
    ) {
      throw new BadRequestException(
        'A reversal must reference another operation.',
      );
    }

    const existingEntries = await manager.find(WalletEntry, {
      where: { operation_id: operation.id },
      order: { id: 'ASC' },
    });

    if (operation.status === WalletOperationStatus.COMPLETED) {
      return { operation, entries: existingEntries, replayed: true };
    }

    if (operation.status === WalletOperationStatus.REVERSED) {
      return { operation, entries: existingEntries, replayed: true };
    }

    if (operation.status === WalletOperationStatus.FAILED) {
      throw new BadRequestException('This wallet operation has failed.');
    }

    if (existingEntries.length > 0) {
      throw new ConflictException(
        'A pending wallet operation already contains ledger entries.',
      );
    }

    const aggregatedEntries = this.aggregateEntries(input.entries);
    const userIds = Array.from(
      new Set(aggregatedEntries.map((entry) => entry.userId)),
    ).sort((a, b) => a.length - b.length || a.localeCompare(b));
    const wallets = await this.ensureAndLockWallets(manager, userIds);
    const walletsByUserId = new Map(
      wallets.map((wallet) => [wallet.user_id, wallet]),
    );

    const createdEntries: WalletEntry[] = [];
    for (const aggregated of aggregatedEntries) {
      const wallet = walletsByUserId.get(aggregated.userId);
      if (!wallet) {
        throw new ConflictException('Wallet could not be locked.');
      }

      const before = this.getBucketBalance(wallet, aggregated.bucket);
      const after = before + aggregated.delta;
      if (after < 0n) {
        throw new BadRequestException('Insufficient wallet balance.');
      }

      const direction =
        aggregated.delta > 0n
          ? WalletEntryDirection.CREDIT
          : WalletEntryDirection.DEBIT;
      const amount =
        aggregated.delta > 0n ? aggregated.delta : -aggregated.delta;
      const beforeText = this.formatScaled(before);
      const afterText = this.formatScaled(after);

      this.setBucketBalance(wallet, aggregated.bucket, afterText);
      wallet.version += 1;
      await manager.save(Wallet, wallet);

      createdEntries.push(
        manager.create(WalletEntry, {
          operation_id: operation.id,
          wallet_id: wallet.id,
          bucket: aggregated.bucket,
          direction,
          amount: this.formatScaled(amount),
          balance_before: beforeText,
          balance_after: afterText,
        }),
      );
    }

    const savedEntries = await manager.save(WalletEntry, createdEntries);
    operation.status = WalletOperationStatus.COMPLETED;
    operation.completed_at = new Date();
    await manager.save(WalletOperation, operation);

    return {
      operation,
      entries: savedEntries,
      replayed: false,
    };
  }

  async releaseSellerPoints(
    manager: EntityManager,
    sellerUserId: string,
    orderId: string,
    amount: string | number,
  ): Promise<WalletLedgerOperationResult> {
    return this.applyOperation(manager, {
      type: WalletOperationType.SELLER_POINTS_RELEASE,
      referenceType: WalletReferenceType.ORDER,
      referenceId: orderId,
      idempotencyKey: `ORDER_POINTS_RELEASE:${orderId}`,
      description: `Release seller points for order #${orderId}`,
      entries: [
        {
          userId: sellerUserId,
          bucket: WalletBalanceBucket.PENDING,
          direction: WalletEntryDirection.DEBIT,
          amount,
        },
        {
          userId: sellerUserId,
          bucket: WalletBalanceBucket.AVAILABLE,
          direction: WalletEntryDirection.CREDIT,
          amount,
        },
      ],
    });
  }

  async reverseOperation(
    manager: EntityManager,
    operationId: string,
  ): Promise<WalletLedgerOperationResult> {
    const operation = await manager
      .getRepository(WalletOperation)
      .createQueryBuilder('operation')
      .where('operation.id = :operationId', { operationId })
      .setLock('pessimistic_write')
      .getOne();

    if (!operation || operation.status !== WalletOperationStatus.COMPLETED) {
      throw new BadRequestException(
        'Only a completed operation can be reversed.',
      );
    }

    const originalEntries = await manager.find(WalletEntry, {
      where: { operation_id: operation.id },
      relations: ['wallet'],
      order: { id: 'ASC' },
    });

    if (!originalEntries.length) {
      throw new BadRequestException(
        'The operation has no ledger entries to reverse.',
      );
    }

    const result = await this.applyOperation(manager, {
      type: WalletOperationType.REVERSAL,
      referenceType: operation.reference_type,
      referenceId: operation.reference_id,
      idempotencyKey: `REVERSAL:${operation.id}`,
      reversesOperationId: operation.id,
      description: `Reversal of wallet operation #${operation.id}`,
      entries: originalEntries.map((entry) => ({
        userId: entry.wallet.user_id,
        bucket: entry.bucket,
        direction:
          entry.direction === WalletEntryDirection.CREDIT
            ? WalletEntryDirection.DEBIT
            : WalletEntryDirection.CREDIT,
        amount: entry.amount,
      })),
    });

    if (operation.status === WalletOperationStatus.COMPLETED) {
      operation.status = WalletOperationStatus.REVERSED;
      await manager.save(WalletOperation, operation);
    }

    return result;
  }

  private async ensureAndLockWallets(
    manager: EntityManager,
    userIds: string[],
  ): Promise<Wallet[]> {
    if (userIds.length === 0) return [];

    const placeholders = userIds.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const parameters = userIds.flatMap((userId) => [
      userId,
      '0.000',
      '0.000',
      'active',
      0,
    ]);
    await manager.query(
      `INSERT IGNORE INTO wallets
        (user_id, available_balance, pending_balance, status, version)
       VALUES ${placeholders}`,
      parameters,
    );

    const wallets = await manager
      .getRepository(Wallet)
      .createQueryBuilder('wallet')
      .where('wallet.user_id IN (:...userIds)', { userIds })
      .orderBy('wallet.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();

    if (wallets.length !== userIds.length) {
      throw new ConflictException('One or more wallets do not exist.');
    }

    return wallets;
  }

  private aggregateEntries(
    entries: WalletLedgerEntryInput[],
  ): AggregatedEntry[] {
    const aggregate = new Map<string, AggregatedEntry>();

    for (const entry of entries) {
      if (!isCanonicalPositiveIntegerString(entry.userId)) {
        throw new BadRequestException('Invalid wallet user id.');
      }

      const amount = this.parsePositiveScaled(entry.amount);
      const key = `${entry.userId}:${entry.bucket}`;
      const delta =
        entry.direction === WalletEntryDirection.CREDIT ? amount : -amount;
      const current = aggregate.get(key);

      if (current) {
        current.delta += delta;
      } else {
        aggregate.set(key, {
          userId: entry.userId,
          bucket: entry.bucket,
          delta,
        });
      }
    }

    return Array.from(aggregate.values())
      .filter((entry) => entry.delta !== 0n)
      .sort(
        (left, right) =>
          left.userId.length - right.userId.length ||
          left.userId.localeCompare(right.userId) ||
          left.bucket.localeCompare(right.bucket),
      );
  }

  private getBucketBalance(
    wallet: Wallet,
    bucket: WalletBalanceBucket,
  ): bigint {
    return this.parseNonNegativeScaled(
      bucket === WalletBalanceBucket.AVAILABLE
        ? wallet.available_balance
        : wallet.pending_balance,
    );
  }

  private setBucketBalance(
    wallet: Wallet,
    bucket: WalletBalanceBucket,
    value: string,
  ): void {
    if (bucket === WalletBalanceBucket.AVAILABLE) {
      wallet.available_balance = value;
    } else {
      wallet.pending_balance = value;
    }
  }

  private hashRequest(input: WalletLedgerOperationInput): string {
    const normalized = {
      type: input.type,
      referenceType: input.referenceType,
      referenceId: input.referenceId ?? null,
      entries: input.entries
        .map((entry) => ({
          userId: entry.userId,
          bucket: entry.bucket,
          direction: entry.direction,
          amount: this.formatScaled(this.parsePositiveScaled(entry.amount)),
        }))
        .sort(
          (left, right) =>
            left.userId.length - right.userId.length ||
            left.userId.localeCompare(right.userId) ||
            left.bucket.localeCompare(right.bucket) ||
            left.direction.localeCompare(right.direction),
        ),
    };

    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  private parsePositiveScaled(value: string | number): bigint {
    const scaled = this.parseNonNegativeScaled(value);
    if (scaled <= 0n) {
      throw new BadRequestException('Wallet amount must be greater than zero.');
    }
    return scaled;
  }

  private parseNonNegativeScaled(value: string | number): bigint {
    const text =
      typeof value === 'number'
        ? Number.isFinite(value)
          ? value.toFixed(3)
          : ''
        : String(value).trim();
    const match = /^(\d+)(?:\.(\d{0,3}))?$/.exec(text);

    if (!match) {
      throw new BadRequestException(
        'Wallet amount must have at most 3 decimals.',
      );
    }

    const fraction = (match[2] || '').padEnd(3, '0');
    return BigInt(match[1]) * 1000n + BigInt(fraction);
  }

  private formatScaled(value: bigint): string {
    const integerPart = value / 1000n;
    const fractionPart = (value % 1000n).toString().padStart(3, '0');
    return `${integerPart}.${fractionPart}`;
  }
}
