export interface IUserLeaderboard {
  username: string;
  score: number;
  rank: number;
  group: string;
}

export interface IUserLeaderboardWithPagination {
  pages: number;
  data: IUserLeaderboard[];
  currentPage: number;
}

export interface IGroupLeaderboard {
  _id: string;
  score: number;
  rank: number;
}
