import {
  Controller,
  Get,
  HttpExceptionOptions,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/common/guards/jwt.guard';
import { Role } from '@/common/enums/role.enum';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { GetUser } from '@/common/decorators/get-user.decorator';
import { IUser } from '@/common/interfaces/user.interface';
import {
  IQuestionResponse,
  IQuestionResponseWithPagination,
} from '@/common/interfaces/question.interface';

@ApiTags('Questions')
@Roles(Role.User, Role.Staff, Role.Auditor, Role.Staff, Role.Admin)
@UseGuards(JwtGuard, RolesGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private questionsService: QuestionsService) {}

  @Get()
  async getQuestions(
    @Query(
      'page',
      new ParseIntPipe({
        errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE,
      }),
    )
    page: number,
    @Query(
      'limit',
      new ParseIntPipe({
        errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE,
      }),
    )
    limit: number,
    @GetUser() user: IUser,
    @Query('tag') tag?: string,
    @Query('level') level?: number,
  ): Promise<IQuestionResponseWithPagination> {
    return this.questionsService.getQuestions(
      page,
      limit,
      user._id,
      tag,
      level,
    );
  }

  @Get('/:id')
  async getQuestionById(
    @Param('id') id: string,
    @GetUser() user: IUser,
  ): Promise<IQuestionResponse> {
    return this.questionsService.getQuestionById(id, user._id);
  }

  @Post('/:id/hint')
  async buyHint(
    @Param('id') id: string,
    @GetUser() user: IUser,
  ): Promise<HttpExceptionOptions> {
    return this.questionsService.buyHint(id, user._id);
  }
}
