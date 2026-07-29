import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomValidationPipe } from './validation.pipe';

class ProfileDto {
  @IsString()
  @IsNotEmpty()
  displayName: string;
}

class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @ValidateNested()
  @Type(() => ProfileDto)
  profile: ProfileDto;
}

describe('CustomValidationPipe', () => {
  const pipe = new CustomValidationPipe();
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: SignupDto,
    data: '',
  };

  const transform = (value: unknown) => pipe.transform(value, metadata);

  const errorsFrom = async (value: unknown): Promise<string[]> => {
    try {
      await transform(value);
      throw new Error('expected the pipe to reject');
    } catch (error) {
      const response = (error as BadRequestException).getResponse();
      return (response as { errors: string[] }).errors;
    }
  };

  it('passes a valid payload through', async () => {
    const value = {
      email: 'user@example.com',
      password: 'Secret123!',
      profile: { displayName: 'John' },
    };

    await expect(transform(value)).resolves.toMatchObject({
      email: 'user@example.com',
    });
  });

  it('rejects an invalid payload with a BadRequest', async () => {
    await expect(
      transform({ email: 'not-an-email', password: '', profile: {} }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports the offending property in the message', async () => {
    const errors = await errorsFrom({
      email: 'not-an-email',
      password: 'Secret123!',
      profile: { displayName: 'John' },
    });

    expect(errors.some((message) => message.startsWith('email:'))).toBe(true);
  });

  it('withholds constraint messages that name a credential', async () => {
    const errors = await errorsFrom({
      email: 'user@example.com',
      password: '',
      profile: { displayName: 'John' },
    });

    // Every message mentioning "password" is filtered out as unsafe, so the
    // failure is reported without echoing credential wording back.
    expect(errors.some((message) => /password/i.test(message))).toBe(false);
  });

  it('flattens nested validation errors under the parent property', async () => {
    const errors = await errorsFrom({
      email: 'user@example.com',
      password: 'Secret123!',
      profile: { displayName: '' },
    });

    expect(errors.some((message) => message.startsWith('profile.'))).toBe(true);
  });

  it('rejects properties that no DTO field declares', async () => {
    // forbidNonWhitelisted is on, so an unexpected field is an error rather
    // than something quietly dropped — a client cannot smuggle isAdmin in.
    await expect(
      transform({
        email: 'user@example.com',
        password: 'Secret123!',
        profile: { displayName: 'John' },
        isAdmin: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
