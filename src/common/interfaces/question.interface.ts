import { IFile } from './file.interface';
import { ITestCase } from './testcase.interface';

export interface IQuestionResponse {
  _id: string;
  title: string;
  description: string;
  author: {
    username: string;
  };
  level: number;
  tags: string[];
  files: IFile[];
  testcases: ITestCase[];
  createdAt: Date;
  updatedAt: Date;
  passedByUser: boolean;
  score: number;
  hintCost: number;
}
