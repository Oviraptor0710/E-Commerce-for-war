import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { User } from '../users/entities/user.entity';
import { Transaction } from './entities/transaction.entity';
import { WalletEntry } from './entities/wallet-entry.entity';
import { WalletEntryDirection } from './enums/wallet-entry-direction.enum';
import { GetBalanceHistoryDto } from './dto/get-balance-history.dto';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../common/constants/response.constants';
import { INITIAL_WALLET_BALANCE } from '../../common/constants/wallet.constants';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(WalletEntry)
    private readonly walletEntryRepository: Repository<WalletEntry>,
  ) {}

  async getCurrentBalance(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) this.tokenInvalid();

    let wallet = await this.walletRepository.findOne({
      where: { user_id: user.id },
    });

    if (!wallet) {
      wallet = this.walletRepository.create({
        user_id: user.id,
        available_balance: INITIAL_WALLET_BALANCE.toFixed(3),
        pending_balance: '0.000',
      });

      wallet = await this.walletRepository.save(wallet);
    }

    return buildResponse(APP_RESPONSE.OK, {
      balance: wallet.available_balance,
      available_balance: wallet.available_balance,
      pending_balance: wallet.pending_balance,
    });
  }

  async getBalanceHistory(body: GetBalanceHistoryDto, userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) this.tokenInvalid();

    const { index, count } = body;

    if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
      this.paramInvalid();
    }

    let wallet = await this.walletRepository.findOne({
      where: { user_id: user.id },
    });

    if (!wallet) {
      wallet = this.walletRepository.create({
        user_id: user.id,
        available_balance: INITIAL_WALLET_BALANCE.toFixed(3),
        pending_balance: '0.000',
      });

      wallet = await this.walletRepository.save(wallet);
    }

    const entries = await this.walletEntryRepository.find({
      where: { wallet_id: wallet.id },
      relations: ['operation'],
      order: { created_at: 'DESC' },
      skip: index,
      take: count,
    });

    if (entries.length > 0) {
      return buildResponse(
        APP_RESPONSE.OK,
        entries.map((entry) => ({
          wallet_entry_id: entry.id,
          operation_id: entry.operation_id,
          object_id: entry.operation?.reference_id || '',
          title: this.getOperationTitle(entry.operation?.type),
          detail: entry.operation?.description || '',
          balance:
            entry.direction === WalletEntryDirection.CREDIT
              ? entry.amount
              : `-${entry.amount}`,
          date: entry.created_at,
          type: entry.operation?.type || '',
        })),
      );
    }

    // Keep old history readable while legacy transactions are being retired.
    const transactions = await this.transactionRepository.find({
      where: { wallet_id: wallet.id },
      order: { created_at: 'DESC' },
      skip: index,
      take: count,
    });

    return buildResponse(
      APP_RESPONSE.OK,
      transactions.map((tx) => ({
        transaction_id: tx.id,
        object_id: null,
        title: this.getTransactionTitle(tx),
        detail: tx.description || '',
        balance: tx.amount ?? '0.000',
        date: tx.created_at,
        type: tx.type || '',
      })),
    );
  }

  private getTransactionTitle(tx: Transaction): string {
    if (tx.type === 'income') return 'Income transaction';
    if (tx.type === 'expense') return 'Expense transaction';
    return 'Wallet transaction';
  }

  private getOperationTitle(type?: string): string {
    const titles: Record<string, string> = {
      order_payment: 'Order payment',
      order_refund: 'Order refund',
      seller_points_release: 'Seller points released',
      reward_credit: 'Achievement reward',
      development_credit: 'Development credit',
      adjustment: 'Wallet adjustment',
      reversal: 'Reversal transaction',
    };
    return titles[type || ''] || 'Wallet transaction';
  }

  private tokenInvalid(): never {
    throw new UnauthorizedException(buildResponse(APP_RESPONSE.TOKEN_INVALID));
  }

  private paramInvalid(): never {
    throw new BadRequestException(
      buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
    );
  }
}
