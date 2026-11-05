import { Exclude, Expose } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  email!: string;

  @Expose()
  firstName!: string;

  @Expose()
  lastName!: string;

  @Expose()
  fullName?: string;

  @Expose()
  phone?: string | null;

  @Expose()
  isActive!: boolean;

  @Expose()
  role?: string;

  @Expose()
  permissions?: string[];

  @Expose()
  company?: any;

  @Expose()
  lastLoginAt?: Date | null;

  @Expose()
  createdAt?: Date;

  @Expose()
  updatedAt?: Date;

  // Sensitive Internal Fields Protected by @Exclude()
  @Exclude()
  passwordHash?: string;

  @Exclude()
  failedLoginAttempts?: number;

  @Exclude()
  lockoutUntil?: Date | null;

  @Exclude()
  lockedUntil?: Date | null;

  @Exclude()
  passwordResetToken?: string | null;

  @Exclude()
  passwordResetTokenHash?: string | null;

  @Exclude()
  passwordResetExpiresAt?: Date | null;

  @Exclude()
  internalRoleNotes?: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
    if (!this.fullName && (this.firstName || this.lastName)) {
      this.fullName = [this.firstName, this.lastName].filter(Boolean).join(' ').trim();
    }
  }
}

