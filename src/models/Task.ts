import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  title: string;
  projectId: string;
  assigneeId: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'HIGH' | 'NORMAL' | 'LOW';
}

const TaskSchema = new Schema<ITask>({
  title: { type: String, required: true },
  projectId: { type: String, required: true, index: true },
  assigneeId: { type: String, required: true },
  status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'DONE'], default: 'TODO' },
  priority: { type: String, enum: ['HIGH', 'NORMAL', 'LOW'], default: 'NORMAL' }
}, { timestamps: true });

export const Task = mongoose.model<ITask>('Task', TaskSchema);