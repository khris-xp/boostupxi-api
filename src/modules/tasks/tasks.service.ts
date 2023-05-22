import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Task } from './schemas/task.schema';
import { ITask } from '@/common/interfaces/task.interface';
import { CreateTaskDto } from './dtos/create-task.dto';
import { IUser } from '@/common/interfaces/user.interface';
import { AwsService } from '../aws/aws.service';
import { UpdateTaskDto } from './dtos/update-task.dto';
import { UpdateAuditTaskDto } from './dtos/update-audit-task.dto';
import { CreateCommentDto } from './dtos/create-comment.dto';
import { UpdateCommentDto } from './dtos/update-comment.dto';
import { v4 as uuidv4 } from 'uuid';
import { UpdateDraftTaskDto } from './dtos/update-draft-task.dto';
import { User } from '../users/schemas/user.schema';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<ITask>,
    @InjectModel(User.name) private readonly userModel: Model<IUser>,
    private awsService: AwsService,
  ) {}

  async createTask(createTaskDto: CreateTaskDto, user: IUser): Promise<ITask> {
    const task = await this.taskModel.findOne({
      title: createTaskDto.title,
    });

    if (task) {
      throw new HttpException('TASK_EXISTED', HttpStatus.BAD_REQUEST);
    }

    const newTask = await this.taskModel.create({
      ...createTaskDto,
      author: user._id,
    });
    return newTask;
  }

  async getTasks(page = 1, limit = 25) {
    const tasks = await this.taskModel
      .find()
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const count = await this.taskModel.countDocuments();
    const pages = Math.ceil(count / limit);

    const formattedTasks = tasks.map(async (task) => {
      const user = await this.userModel.findById(task.author);

      task.author = {
        id: user._id,
        username: user.username,
      };

      const comments = await Promise.all(
        task.comments.map(async (comment) => {
          const user = await this.userModel.findById(comment.author);

          comment.author = {
            id: user._id,
            username: user.username,
          };

          return comment;
        }),
      );

      task.comments = comments;

      return task;
    });

    return {
      currentPage: page,
      pages,
      data: await Promise.all(formattedTasks),
    };
  }

  async getFeedTasks(page = 1, limit = 25) {
    const tasks = await this.taskModel
      .find({ draft: false })
      .select('-comments -solution_code -status -draft')
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const count = await this.taskModel.countDocuments({ draft: false });
    const pages = Math.ceil(count / limit);

    const formattedTasks = tasks.map(async (task) => {
      const user = await this.userModel.findById(task.author);

      task.author = {
        id: user._id,
        username: user.username,
      };

      return task;
    });

    return {
      currentPage: page,
      pages,
      data: await Promise.all(formattedTasks),
    };
  }

  async getTaskById(id: string): Promise<ITask> {
    const task = await this.taskModel.findById(id);

    if (!task) {
      throw new HttpException('TASK_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const user = await this.userModel.findById(task.author);

    task.author = {
      id: user._id,
      username: user.username,
    };

    const comments = await Promise.all(
      task.comments.map(async (comment) => {
        const user = await this.userModel.findById(comment.author);

        comment.author = {
          id: user._id,
          username: user.username,
        };

        return comment;
      }),
    );

    task.comments = comments;

    return task;
  }

  async updateTask(id: string, updateTaskDto: UpdateTaskDto, user: IUser) {
    const task = await this.taskModel.findById(id);

    if (!task) {
      throw new HttpException('TASK_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (
      task.author.id.toString() !== user._id.toString() &&
      user.role !== 'admin'
    ) {
      throw new HttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }

    const updatedTask = await this.taskModel.findByIdAndUpdate(
      id,
      updateTaskDto,
      { new: true },
    );

    return updatedTask;
  }

  async auditTask(
    id: string,
    updateAuditTaskDto: UpdateAuditTaskDto,
    user: IUser,
  ) {
    const task = await this.taskModel.findById(id);

    if (!task) {
      throw new HttpException('TASK_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (task.author.id.toString() !== user._id.toString()) {
      const updatedTask = await this.taskModel.findByIdAndUpdate(
        id,
        updateAuditTaskDto,
        { new: true },
      );
      return updatedTask;
    } else {
      throw new HttpException(
        'CAN_NOT_AUDIT_YOUR_OWN_TASK',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async draftTask(id: string, updateDraftTaskDto: UpdateDraftTaskDto) {
    const task = await this.taskModel.findById(id);

    if (!task) {
      throw new HttpException('TASK_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const updatedTask = await this.taskModel.findByIdAndUpdate(
      id,
      updateDraftTaskDto,
      { new: true },
    );

    return updatedTask;
  }

  async deleteTask(id: string, user: IUser) {
    const task = await this.taskModel.findById(id);

    if (!task) {
      throw new HttpException('TASK_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (
      task.author.id.toString() !== user._id.toString() &&
      user.role !== 'admin'
    ) {
      throw new HttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }

    const keys = task.files.map((file) => ({ key: file.key }));
    await this.awsService.deleteFiles(keys);
    await this.taskModel.findByIdAndDelete(id);
    throw new HttpException('TASK_DELETED', HttpStatus.OK);
  }

  async createComment(
    id: string,
    user: IUser,
    createCommentDto: CreateCommentDto,
  ) {
    const task = await this.taskModel.findById(id);

    if (!task) {
      throw new HttpException('TASK_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const newComment = {
      ...createCommentDto,
      author: user._id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      id: uuidv4(),
    };

    const updatedTask = await this.taskModel.findByIdAndUpdate(
      id,
      { $push: { comments: newComment } },
      { new: true },
    );

    return updatedTask;
  }

  async deleteComment(id: string, user: IUser, commentId: string) {
    const task = await this.taskModel.findById(id);

    if (!task) {
      throw new HttpException('TASK_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const comment = task.comments.find(
      (comment) => comment.id.toString() === commentId,
    );

    if (!comment) {
      throw new HttpException('COMMENT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (comment.author.id.toString() !== user._id.toString()) {
      throw new HttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }

    const deletedComment = await this.taskModel.findByIdAndUpdate(
      id,
      { $pull: { comments: { id: commentId } } },
      { new: true },
    );

    if (!deletedComment) {
      throw new HttpException('COMMENT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    throw new HttpException('TASK_DELETED', HttpStatus.OK);
  }

  async updateComment(
    id: string,
    user: IUser,
    updateCommentDto: UpdateCommentDto,
    commentId: string,
  ) {
    const task = await this.taskModel.findById(id);

    if (!task) {
      throw new HttpException('TASK_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const comment = task.comments.find(
      (comment) => comment.id.toString() === commentId,
    );

    if (!comment) {
      throw new HttpException('COMMENT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (comment.author.id.toString() !== user._id.toString()) {
      throw new HttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }

    const updatedComment = await this.taskModel.findByIdAndUpdate(
      id,
      {
        $set: {
          'comments.$[comment].message': updateCommentDto.message,
          'comments.$[comment].updatedAt': new Date().toISOString(),
        },
      },
      {
        arrayFilters: [{ 'comment.id': commentId }],
        new: true,
      },
    );

    return updatedComment;
  }
}
