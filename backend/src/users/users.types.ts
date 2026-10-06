export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

export interface UserWithCredentials extends PublicUser {
  passwordHash: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
}
