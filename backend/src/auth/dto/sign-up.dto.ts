import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trim, trimAndLowercase } from '../../common/transforms.js';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
} from '../password-policy.js';

export class SignUpDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(trimAndLowercase)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Jane Doe', minLength: 3, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'Str0ngP@ssword!',
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  password: string;
}
