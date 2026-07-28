import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { ApiEnvelopeResponse } from './common/decorators';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Service greeting',
    description: 'Basic liveness endpoint returning a static greeting.',
    security: [],
  })
  @ApiEnvelopeResponse('string', {
    status: 200,
    description: 'Service is reachable',
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
