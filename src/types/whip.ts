export interface WhipEventItem {
  _id?: string;
  taskId: string;
  taskTitle: string;
  triggeredBy: string;
  targetOperators: string[];
  message: string;
  createdAt: string | Date;
}

