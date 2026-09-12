import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductCategoryResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  parent_id!: string | null;

  @ApiProperty({ type: Number })
  sort!: number;

  @ApiProperty({ type: Boolean })
  has_child!: boolean;

  @ApiProperty({ type: Boolean })
  has_brand!: boolean;

  @ApiProperty({ type: Boolean })
  has_size!: boolean;

  @ApiProperty({ type: Boolean })
  require_weight!: boolean;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true })
  image_url!: string | null;
}

export class ProductBrandResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  brand_name!: string;
}

export class ProductVariantResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  size!: string | null;

  @ApiProperty({ type: String, nullable: true })
  color!: string | null;

  @ApiProperty({ type: String, description: 'Giá niêm yết, DECIMAL(20,3).' })
  price!: string;

  @ApiProperty({ type: String, description: 'Giá hiệu lực sau giảm, DECIMAL(20,3).' })
  price_new!: string;

  @ApiProperty({ type: Number })
  stock!: number;

  @ApiPropertyOptional({ type: String, description: 'Khối lượng được serialize thành chuỗi.' })
  weight?: string;
}

export class ProductSummaryResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, description: 'Giá thấp nhất, DECIMAL(20,3).' })
  price!: string;

  @ApiProperty({ type: String, description: 'Giá thấp nhất, DECIMAL(20,3).' })
  price_min!: string;

  @ApiProperty({ type: String, description: 'Giá cao nhất, DECIMAL(20,3).' })
  price_max!: string;

  @ApiProperty({ type: String, nullable: true })
  image!: string | null;

  @ApiProperty({ type: Object, nullable: true })
  video!: Record<string, unknown> | null;

  @ApiProperty({ type: Number })
  like!: number;

  @ApiProperty({ type: Number })
  comment!: number;

  @ApiProperty({ type: Boolean })
  is_liked!: boolean;

  @ApiProperty({ type: Boolean })
  is_stock!: boolean;

  @ApiPropertyOptional({ type: () => ProductBrandResponseDto, nullable: true })
  brand?: ProductBrandResponseDto | null;

  @ApiPropertyOptional({ type: () => ProductCategoryResponseDto, nullable: true })
  category?: ProductCategoryResponseDto | null;

  @ApiProperty({ type: () => [ProductVariantResponseDto] })
  variants!: ProductVariantResponseDto[];
}

export class ProductSellerResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  username!: string;

  @ApiProperty({ type: String })
  avatar!: string;

  @ApiProperty({ type: String })
  cover_image!: string;

  @ApiProperty({ type: String, nullable: true })
  cover_image_web!: string | null;

  @ApiProperty({ type: String })
  fullname!: string;

  @ApiProperty({ type: String })
  shop_name!: string;
}

export class ProductDetailResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) price!: string;
  @ApiProperty({ type: String }) price_min!: string;
  @ApiProperty({ type: String }) price_max!: string;
  @ApiProperty({ type: String }) described!: string;
  @ApiProperty({ type: String, format: 'date-time' }) created!: string;
  @ApiProperty({ type: Number }) like!: number;
  @ApiProperty({ type: Number }) comment!: number;
  @ApiProperty({ type: Boolean }) is_liked!: boolean;
  @ApiProperty({ type: () => [String] }) image!: string[];
  @ApiProperty({ type: () => [Object] }) video!: Record<string, unknown>[];
  @ApiProperty({ type: () => [ProductVariantResponseDto] }) size!: ProductVariantResponseDto[];
  @ApiProperty({ type: () => ProductBrandResponseDto, nullable: true }) brand!: ProductBrandResponseDto | null;
  @ApiProperty({ type: () => ProductCategoryResponseDto, nullable: true }) category!: ProductCategoryResponseDto | null;
  @ApiProperty({ type: () => ProductSellerResponseDto, nullable: true }) seller!: ProductSellerResponseDto | null;
  @ApiProperty({ type: String }) ships_from!: string;
  @ApiProperty({ type: Boolean }) can_edit!: boolean;
  @ApiProperty({ type: () => [Object] }) best_offers!: Record<string, unknown>[];
  @ApiProperty({ type: () => [Object] }) messages!: Record<string, unknown>[];
}

export class CommentMediaResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) type!: string;
  @ApiProperty({ type: String }) mime_type!: string;
  @ApiProperty({ type: String }) url!: string;
  @ApiProperty({ type: Number }) position!: number;
}

export class ProductCommentResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) product_id!: string;
  @ApiProperty({ type: String }) user_id!: string;
  @ApiProperty({ type: String, nullable: true }) content!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: string;
  @ApiProperty({ type: String, nullable: true }) username!: string | null;
  @ApiProperty({ type: String, nullable: true }) avatar!: string | null;
  @ApiProperty({ type: String, nullable: true }) cover_image!: string | null;
  @ApiProperty({ type: String, nullable: true }) cover_image_web!: string | null;
  @ApiProperty({ type: () => [CommentMediaResponseDto] }) media!: CommentMediaResponseDto[];
}

export class ProductLikeResponseDataDto {
  @ApiProperty({ type: Boolean }) is_liked!: boolean;
  @ApiProperty({ type: Number }) like_count!: number;
}

export class ProductReportResponseDataDto {
  @ApiProperty({ type: String }) product_id!: string;
  @ApiProperty({ type: String }) user_id!: string;
  @ApiProperty({ type: String }) reason!: string;
}

/** Product entity shape returned by keyword search. */
export class ProductSearchResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) seller_id!: string;
  @ApiProperty({ type: String }) ship_from_id!: string;
  @ApiProperty({ type: String }) category_id!: string;
  @ApiProperty({ type: String, nullable: true }) brand_id!: string | null;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String }) min_price!: string;
  @ApiProperty({ type: String }) max_price!: string;
  @ApiProperty({ type: () => [String], nullable: true }) image_urls!: string[] | null;
  @ApiProperty({ type: () => [Object], nullable: true }) videos!: Record<string, unknown>[] | null;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: string;
}

export class ProductMutationResponseDto extends ProductSearchResponseDto {
  @ApiProperty({ type: String }) name!: string;
  @ApiPropertyOptional({ type: () => [ProductVariantResponseDto] })
  variants?: ProductVariantResponseDto[];
}
