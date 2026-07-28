import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService, LoginDto } from './auth.service';
import { CreateUserDto } from '../users/dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public, CurrentUser } from './decorators';
import { UserResponseDto } from '../users/dto';
import { RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto } from './dto';
import {
  LoginResponseDto,
  RefreshResponseDto,
  RegisterResponseDto,
  MessageResponseDto,
} from './dto/auth-response.dto';
import {
  ApiEnvelopeResponse,
  ApiEnvelopeMessageResponse,
  ApiErrorResponse,
} from '../common/decorators';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Creates a new user account with the provided credentials.',
  })
  @ApiEnvelopeResponse(RegisterResponseDto, {
    status: 201,
    description: 'User registered successfully',
  })
  @ApiErrorResponse({
    status: 400,
    description: 'Invalid input data or validation errors',
    message: 'Validation failed',
  })
  @ApiErrorResponse({
    status: 409,
    description: 'User already exists with this email or username',
    message: 'User with this email already exists',
  })
  async register(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    createUserDto: CreateUserDto,
  ): Promise<RegisterResponseDto> {
    return this.authService.register(createUserDto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticates a user with email and password, returns access and refresh tokens.',
  })
  @ApiEnvelopeResponse(LoginResponseDto, {
    status: 200,
    description: 'Login successful',
  })
  @ApiErrorResponse({
    status: 400,
    description: 'Invalid input data',
    message: 'Validation failed',
  })
  @ApiErrorResponse({
    status: 401,
    description: 'Invalid credentials or account locked',
    message: 'Invalid credentials',
  })
  async login(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    loginDto: LoginDto,
  ): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Generates a new access token and refresh token using a valid refresh token.',
  })
  @ApiEnvelopeResponse(RefreshResponseDto, {
    status: 200,
    description: 'Token refreshed successfully',
  })
  @ApiErrorResponse({
    status: 400,
    description: 'Invalid input data',
    message: 'Validation failed',
  })
  @ApiErrorResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
    message: 'Invalid refresh token',
  })
  async refresh(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    refreshTokenDto: RefreshTokenDto,
  ): Promise<RefreshResponseDto> {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'User logout',
    description: 'Invalidates the refresh token and logs out the user.',
  })
  @ApiEnvelopeMessageResponse({
    status: 200,
    description: 'Logout successful',
    message: 'Logged out successfully',
  })
  @ApiErrorResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
    message: 'Unauthorized',
  })
  async logout(
    @CurrentUser() user: UserResponseDto,
  ): Promise<MessageResponseDto> {
    return this.authService.logout(user.id);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Sends a password reset email to the specified email address.',
  })
  @ApiEnvelopeMessageResponse({
    status: 200,
    description:
      'Password reset request accepted. Returns the same response whether or not the email exists.',
    message: 'If the email exists, a password reset link has been sent',
  })
  @ApiErrorResponse({
    status: 400,
    description: 'Invalid email format',
    message: 'Please provide a valid email address',
  })
  async forgotPassword(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<MessageResponseDto> {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password',
    description: 'Resets the user password using a valid reset token.',
  })
  @ApiEnvelopeMessageResponse({
    status: 200,
    description: 'Password reset successfully',
    message: 'Password reset successfully',
  })
  @ApiErrorResponse({
    status: 400,
    description:
      'Invalid input data, password requirements not met, or reset token is invalid/expired',
    message: 'Invalid or expired reset token',
  })
  async resetPassword(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    resetPasswordDto: ResetPasswordDto,
  ): Promise<MessageResponseDto> {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }
}
