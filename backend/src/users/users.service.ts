import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isObjectIdOrHexString, Model, mongo } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema.js';
import {
  CreateUserInput,
  PublicUser,
  UserWithCredentials,
} from './users.types.js';

const DUPLICATE_KEY_ERROR_CODE = 11000;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof mongo.MongoServerError &&
    error.code === DUPLICATE_KEY_ERROR_CODE
  );
}

function toPublicUser(user: UserDocument): PublicUser {
  return { id: user.id, email: user.email, name: user.name };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async create(input: CreateUserInput): Promise<PublicUser> {
    try {
      const user = await this.userModel.create(input);
      return toPublicUser(user);
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserWithCredentials | null> {
    const user = await this.userModel
      .findOne({ email })
      .select('+passwordHash');
    if (!user) return null;

    return { ...toPublicUser(user), passwordHash: user.passwordHash };
  }

  async findById(id: string): Promise<PublicUser | null> {
    if (!isObjectIdOrHexString(id)) return null;

    const user = await this.userModel.findById(id);
    return user ? toPublicUser(user) : null;
  }
}
