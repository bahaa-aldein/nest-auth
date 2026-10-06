import { ApiProperty } from '@nestjs/swagger';
import type { PublicUser } from '../users.types.js';

export class PublicUserDto implements PublicUser {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'Jane Doe' })
  name: string;
}
