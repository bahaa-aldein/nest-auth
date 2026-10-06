import { ConflictException } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { User } from './schemas/user.schema.js';
import { UsersService } from './users.service.js';
import { UsersModule } from './users.module.js';

const input = {
  email: 'jane@example.com',
  name: 'Jane',
  passwordHash: '$argon2id$not-a-real-hash',
};

describe('UsersService', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let service: UsersService;
  let userModel: Model<User>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri('users-test')),
        UsersModule,
      ],
    }).compile();

    service = moduleRef.get(UsersService);
    userModel = moduleRef.get(getModelToken(User.name));
    // Wait for the unique index so duplicate detection is deterministic.
    await userModel.init();
  });

  afterEach(async () => {
    await userModel.deleteMany({});
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  describe('create', () => {
    it('returns the public user without the password hash', async () => {
      const user = await service.create(input);

      expect(user).toEqual({
        id: expect.any(String),
        email: 'jane@example.com',
        name: 'Jane',
      });
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('stores the email trimmed and lowercased', async () => {
      await service.create({ ...input, email: '  Jane@Example.COM ' });

      const stored = await userModel.findOne().lean();
      expect(stored?.email).toBe('jane@example.com');
    });

    it('rejects a duplicate email, ignoring case, with a 409', async () => {
      await service.create(input);

      await expect(
        service.create({ ...input, email: 'JANE@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects concurrent sign-ups for the same email with exactly one 409', async () => {
      const results = await Promise.allSettled([
        service.create(input),
        service.create(input),
      ]);

      const rejected = results.filter((r) => r.status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    });

    it('does not select the password hash unless asked for', async () => {
      await service.create(input);

      const plain = await userModel.findOne();
      const withHash = await userModel.findOne().select('+passwordHash');

      expect(plain?.passwordHash).toBeUndefined();
      expect(withHash?.passwordHash).toBe(input.passwordHash);
    });

    it('never serialises the password hash, even for a raw document', async () => {
      const document = await userModel.create(input);

      expect(document.toJSON()).not.toHaveProperty('passwordHash');
    });
  });

  describe('findByEmail', () => {
    it('returns the user including the password hash', async () => {
      const created = await service.create(input);

      await expect(service.findByEmail('jane@example.com')).resolves.toEqual({
        ...created,
        passwordHash: input.passwordHash,
      });
    });

    it('is case-insensitive', async () => {
      await service.create(input);

      await expect(
        service.findByEmail('JANE@Example.com'),
      ).resolves.not.toBeNull();
    });

    it('returns null for an unknown email', async () => {
      await expect(
        service.findByEmail('nobody@example.com'),
      ).resolves.toBeNull();
    });
  });

  describe('findById', () => {
    it('returns the public user without the password hash', async () => {
      const created = await service.create(input);

      const found = await service.findById(created.id);

      expect(found).toEqual(created);
      expect(found).not.toHaveProperty('passwordHash');
    });

    it('returns null for an unknown id', async () => {
      await expect(
        service.findById(new Types.ObjectId().toString()),
      ).resolves.toBeNull();
    });

    it.each(['not-an-id', '', '123', 'abcdefghijkl'])(
      'returns null for the malformed id %j instead of throwing',
      async (id) => {
        await expect(service.findById(id)).resolves.toBeNull();
      },
    );
  });
});
