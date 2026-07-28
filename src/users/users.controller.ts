import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  QueryUserDto,
  ChangePasswordDto,
  UserResponseDto,
  UpdateUserRoleDto,
} from './dto';
import { MessageResponseDto, PaginatedResponseDto } from '../common/dto';
import {
  ApiEnvelopeResponse,
  ApiEnvelopePaginatedResponse,
  ApiEnvelopeMessageResponse,
  ApiErrorResponse,
} from '../common/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public, Roles, CurrentUser } from '../auth/decorators';
import { UserRole } from '../database/schema';

const UNAUTHORIZED = {
  status: 401,
  description: 'Unauthorized - Invalid or missing authentication',
  message: 'Unauthorized',
};
const NOT_FOUND = {
  status: 404,
  description: 'User not found',
  message: 'User not found',
};
const forbidden = (roles: string) => ({
  status: 403,
  description: `Forbidden - ${roles} access required`,
  message: 'Forbidden resource',
});

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Public() // Allow public registration
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Creates a new user account. Public registration allowed.',
    security: [], // @Public() route — overrides the controller-level bearer auth
  })
  @ApiEnvelopeResponse(UserResponseDto, {
    status: 201,
    description: 'User created successfully',
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
  async create(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({
    summary: 'Get all users',
    description:
      'Retrieves a paginated list of users with optional filtering and sorting. Admin or Moderator access required.',
  })
  @ApiEnvelopePaginatedResponse(UserResponseDto, {
    status: 200,
    description: 'Users retrieved successfully',
  })
  @ApiErrorResponse({
    status: 400,
    description: 'Invalid query parameters',
    message: 'Invalid sort field: foo',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(forbidden('Admin or Moderator'))
  async findAll(
    // Query params are documented from QueryUserDto's @ApiPropertyOptional
    // metadata — do not duplicate them with @ApiQuery.
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    queryDto: QueryUserDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    return this.usersService.findAll(queryDto);
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Retrieves the profile information of the currently authenticated user.',
  })
  @ApiEnvelopeResponse(UserResponseDto, {
    status: 200,
    description: 'Profile retrieved successfully',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(NOT_FOUND)
  async getProfile(
    @CurrentUser() user: UserResponseDto,
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({
    summary: 'Get user by ID',
    description:
      'Retrieves a specific user by their unique identifier. Admin or Moderator access required.',
  })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiEnvelopeResponse(UserResponseDto, {
    status: 200,
    description: 'User retrieved successfully',
  })
  @ApiErrorResponse({
    status: 400,
    description: 'Malformed UUID',
    message: 'Validation failed (uuid is expected)',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(forbidden('Admin or Moderator'))
  @ApiErrorResponse(NOT_FOUND)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Update current user profile',
    description:
      'Updates the profile information of the currently authenticated user. Only firstName, lastName and profilePicture are applied.',
  })
  @ApiEnvelopeResponse(UserResponseDto, {
    status: 200,
    description: 'Profile updated successfully',
  })
  @ApiErrorResponse({
    status: 400,
    description: 'Invalid input data or validation errors',
    message: 'Validation failed',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(NOT_FOUND)
  async updateProfile(
    @CurrentUser() user: UserResponseDto,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // Users can only update their own profile (excluding sensitive fields)
    const allowedFields = {
      firstName: updateUserDto.firstName,
      lastName: updateUserDto.lastName,
      profilePicture: updateUserDto.profilePicture,
    };

    // Remove undefined fields
    const filteredUpdate = Object.fromEntries(
      Object.entries(allowedFields).filter(([, value]) => value !== undefined),
    );

    return this.usersService.update(user.id, filteredUpdate);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update user by ID',
    description:
      'Updates a specific user by their unique identifier. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiEnvelopeResponse(UserResponseDto, {
    status: 200,
    description: 'User updated successfully',
  })
  @ApiErrorResponse({
    status: 400,
    description: 'Invalid input data or validation errors',
    message: 'Validation failed',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(forbidden('Admin'))
  @ApiErrorResponse(NOT_FOUND)
  @ApiErrorResponse({
    status: 409,
    description: 'Email or username already exists',
    message: 'User with this email already exists',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change user password',
    description: 'Changes the password for the currently authenticated user.',
  })
  @ApiEnvelopeMessageResponse({
    status: 200,
    description: 'Password changed successfully',
    message: 'Password changed successfully',
  })
  @ApiErrorResponse({
    status: 400,
    description:
      'Invalid input data, password requirements not met, or passwords do not match',
    message: 'New password and confirm password do not match',
  })
  @ApiErrorResponse({
    status: 401,
    description:
      'Unauthorized - Invalid current password or missing authentication',
    message: 'Current password is incorrect',
  })
  async changePassword(
    @CurrentUser() user: UserResponseDto,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    changePasswordDto: ChangePasswordDto,
  ): Promise<MessageResponseDto> {
    return this.usersService.changePassword(user.id, changePasswordDto);
  }

  @Delete('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete current user profile',
    description:
      'Soft deletes the currently authenticated user account. Requires a valid JWT access token.',
  })
  @ApiEnvelopeMessageResponse({
    status: 200,
    description: 'Account deactivated successfully',
    message: 'Account deactivated successfully',
  })
  @ApiErrorResponse({
    ...UNAUTHORIZED,
    description: 'Unauthorized - Invalid or missing JWT access token',
  })
  @ApiErrorResponse(NOT_FOUND)
  async deleteProfile(
    @CurrentUser() user: UserResponseDto,
  ): Promise<MessageResponseDto> {
    // Soft delete for user's own account
    await this.usersService.softDelete(user.id);
    return { message: 'Account deactivated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete user by ID',
    description:
      'Permanently deletes a user by their unique identifier. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiEnvelopeMessageResponse({
    status: 200,
    description: 'User deleted successfully',
    message: 'User deleted successfully',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(forbidden('Admin'))
  @ApiErrorResponse(NOT_FOUND)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MessageResponseDto> {
    return this.usersService.remove(id);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate user',
    description: 'Activates a user account. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiEnvelopeResponse(UserResponseDto, {
    status: 200,
    description: 'User activated successfully',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(forbidden('Admin'))
  @ApiErrorResponse(NOT_FOUND)
  async activateUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, { isActive: true });
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate user',
    description: 'Deactivates a user account. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiEnvelopeResponse(UserResponseDto, {
    status: 200,
    description: 'User deactivated successfully',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(forbidden('Admin'))
  @ApiErrorResponse(NOT_FOUND)
  async deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, { isActive: false });
  }

  @Patch(':id/verify-email')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify user email',
    description:
      'Marks a user email as verified. Admin or Moderator access required.',
  })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiEnvelopeResponse(UserResponseDto, {
    status: 200,
    description: 'User email verified successfully',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(forbidden('Admin or Moderator'))
  @ApiErrorResponse(NOT_FOUND)
  async verifyEmail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, { isEmailVerified: true });
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user role',
    description: 'Updates a user role. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiEnvelopeResponse(UserResponseDto, {
    status: 200,
    description: 'User role updated successfully',
  })
  @ApiErrorResponse({
    status: 400,
    description: 'Invalid role',
    message: 'role must be one of: user, admin, moderator',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(forbidden('Admin'))
  @ApiErrorResponse(NOT_FOUND)
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    updateUserRoleDto: UpdateUserRoleDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, { role: updateUserRoleDto.role });
  }

  @Get('search/by-email')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({
    summary: 'Find user by email',
    description:
      'Searches for a user by email address. Admin or Moderator access required.',
  })
  @ApiQuery({
    name: 'email',
    description: 'Email address to search for',
    type: 'string',
  })
  @ApiEnvelopeResponse(UserResponseDto, {
    status: 200,
    description: 'User found, or null when no user matches the email',
    nullable: true,
  })
  @ApiErrorResponse({
    status: 400,
    description: 'Email parameter is required',
    message: 'Email query parameter is required',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(forbidden('Admin or Moderator'))
  async findByEmail(
    @Query('email') email: string,
  ): Promise<UserResponseDto | null> {
    if (!email) {
      throw new BadRequestException('Email query parameter is required');
    }
    return this.usersService.findByEmail(email);
  }

  @Get('search/by-username')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({
    summary: 'Find user by username',
    description:
      'Searches for a user by username. Admin or Moderator access required.',
  })
  @ApiQuery({
    name: 'username',
    description: 'Username to search for',
    type: 'string',
  })
  @ApiEnvelopeResponse(UserResponseDto, {
    status: 200,
    description: 'User found, or null when no user matches the username',
    nullable: true,
  })
  @ApiErrorResponse({
    status: 400,
    description: 'Username parameter is required',
    message: 'Username query parameter is required',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(forbidden('Admin or Moderator'))
  async findByUsername(
    @Query('username') username: string,
  ): Promise<UserResponseDto | null> {
    if (!username) {
      throw new BadRequestException('Username query parameter is required');
    }
    return this.usersService.findByUsername(username);
  }
}
