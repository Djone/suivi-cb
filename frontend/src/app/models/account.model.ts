export interface Account {
  id?: number;
  name: string;
  description?: string;
  color?: string;
  isActive?: number;
  createdAt?: Date;
  [key: string]: any;
}
