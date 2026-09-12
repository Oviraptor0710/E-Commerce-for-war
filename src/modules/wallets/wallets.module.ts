import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { WalletOperation } from './entities/wallet-operation.entity';
import { WalletEntry } from './entities/wallet-entry.entity';
import { User } from '../users/entities/user.entity';
import { WalletsService } from './wallets.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletsController } from './wallets.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Wallet,
      Transaction,
      WalletOperation,
      WalletEntry,
      User,
    ]),
  ],
  providers: [WalletsService, WalletLedgerService],
  controllers: [WalletsController],
  exports: [WalletsService, WalletLedgerService],
})
export class WalletsModule {}
