import mongoose, { type Document, type Model } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
}

const userSchema = new mongoose.Schema<IUser>({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  displayName:  { type: String, required: true, trim: true, maxlength: 64 },
  createdAt:    { type: Date, default: Date.now },
});

// Never return the password hash over the wire
userSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform(_doc: unknown, ret: any) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
