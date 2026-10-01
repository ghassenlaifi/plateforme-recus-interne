export type TaskCategory = 'Commercial' | 'Finance' | 'Pédagogie' | 'Général';
export type TaskPriority = 'Haute' | 'Normale' | 'Basse';

export interface TaskNote {
  _id?: string;
  id?: string;
  author: string;
  text: string;
  createdAt: string | Date;
}

export interface TaskItem {
  _id?: string;
  id?: string;
  title: string;
  assignedTo: string[];
  category: TaskCategory;
  priority: TaskPriority;
  dueDate: string;
  completed: boolean;
  completedAt?: string | Date | null;
  completedBy?: string | null;
  notes?: TaskNote[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

