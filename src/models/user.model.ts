import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  whatsappNumber: string;
  name: string;
  subscriptionStatus: "free" | "paid";
  subscriptionPlan: {
    startDate: Date;
    expiryDate: Date;
    planType: string;
    paymentStatus?: "pending" | "completed";
    transactionRef?: string;
  } | null;
  preferredStates: string[];
  preferredDistricts: string[];
  messagingLogs: {
    timestamp: Date;
    message: string;
    direction: "sent" | "received";
  }[];
  referralCode: string; // Unique referral code for user
  referredBy?: string | null; // Referral code of the user who referred this user
  credits: number; // Credit balance
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema(
  {
    startDate: Date,
    expiryDate: Date,
    planType: String,
    paymentStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    transactionRef: String,
  },
  { _id: false }
);

const MessagingLogSchema = new Schema(
  {
    timestamp: { type: Date, default: Date.now },
    message: String,
    direction: { type: String, enum: ["sent", "received"] },
  },
  { _id: false }
);

const UserSchema: Schema<IUser> = new Schema(
  {
    whatsappNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    subscriptionStatus: {
      type: String,
      enum: ["free", "paid"],
      default: "free",
    },
    subscriptionPlan: { type: SubscriptionSchema, default: null },
    preferredStates: { type: [String], default: ["Jharkhand"] },
    preferredDistricts: { type: [String], default: [] },
    messagingLogs: [MessagingLogSchema],
    referralCode: { type: String, required: true, unique: true },
    referredBy: { type: String, default: null },
    credits: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUser>("User", UserSchema);

export default User;
