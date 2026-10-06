import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimAndLowercase } from '../../common/transforms.js';
import { PASSWORD_MAX_LENGTH } from '../password-policy.js';

export class SignInDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(trimAndLowercase)
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Str0ngP@ssword!', maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}
