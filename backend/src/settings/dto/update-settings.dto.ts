import { IsOptional, IsString, IsNumber, IsBoolean, IsObject } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  restaurantName?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @IsBoolean()
  enableKds?: boolean;

  @IsOptional()
  @IsObject()
  printerConfig?: Record<string, any>;
}
