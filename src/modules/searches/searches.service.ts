import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedSearch } from './entities/saved_search.entity';

@Injectable()
export class SearchesService {
  constructor(
    @InjectRepository(SavedSearch)
    private readonly savedSearchRepository: Repository<SavedSearch>,
  ) {}

  private normalizeKeyword(keyword: string) {
    return keyword.trim().replace(/\s+/g, ' ');
  }

  async saveSearch(userId: string, keyword: string) {
    const normalizedKeyword = this.normalizeKeyword(keyword);

    if (!normalizedKeyword) {
      return null;
    }

    await this.savedSearchRepository.delete({
      user_id: userId,
      keyword: normalizedKeyword,
    });

    const saved = this.savedSearchRepository.create({
      user_id: userId,
      keyword: normalizedKeyword,
    });

    return await this.savedSearchRepository.save(saved);
  }

  async getListSavedSearch(userId: string, index: number, count: number) {
    return await this.savedSearchRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip: index,
      take: count,
    });
  }

  async delSavedSearch(userId: string, searchId?: string, keyword?: string) {
    if (searchId === '0') {
      await this.savedSearchRepository.delete({ user_id: userId });
      return true;
    }

    if (searchId !== undefined) {
      const result = await this.savedSearchRepository.delete({
        id: searchId,
        user_id: userId,
      });
      return (result.affected ?? 0) > 0;
    }

    if (keyword !== undefined && keyword !== '') {
      const result = await this.savedSearchRepository.delete({
        user_id: userId,
        keyword,
      });
      return (result.affected ?? 0) > 0;
    }

    return false;
  }
}
