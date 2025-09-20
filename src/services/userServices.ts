import User, { IUser } from "../models/user.model";
import crypto from "crypto";

interface RegisterUserData {
  whatsappNumber: string;
  name: string;
  email?: string;
  referredBy?: string;
  preferredStates?: string[];
  preferredDistricts?: string[];
}

export class UserService {
  // Helper to generate referral code
  private generateReferralCode(): string {
    return crypto.randomBytes(3).toString("hex").toUpperCase();
  }

  // Register user method
  public async registerUser(userData: RegisterUserData): Promise<IUser> {
    const {
      whatsappNumber,
      name,
      email,
      referredBy,
      preferredStates,
      preferredDistricts,
    } = userData;

    const existingUser = await User.findOne({
      $or: [{ whatsappNumber }, ...(email ? [{ email }] : [])],
    });

    if (existingUser) {
      throw new Error(
        "User with this WhatsApp number or email already registered"
      );
    }

    let referralCode: string = "";
    let isUnique = false;
    while (!isUnique) {
      referralCode = this.generateReferralCode();
      const exists = await User.findOne({ referralCode });
      if (!exists) isUnique = true;
    }

    const newUserData: Partial<IUser> = {
      whatsappNumber,
      name,
      email,
      subscriptionStatus: "free",
      subscriptionPlan: null,
      preferredStates: preferredStates ?? ["Jharkhand"],
      preferredDistricts: preferredDistricts ?? [],
      referralCode,
      credits: 0,
      messagingLogs: [],
    };

    if (referredBy) {
      const referrer = await User.findOne({ referralCode: referredBy });
      if (referrer) {
        referrer.credits += 20;
        await referrer.save();
        newUserData.referredBy = referredBy;
      }
    }

    const newUser = new User(newUserData);
    await newUser.save();

    return newUser;
  }

  // Add other user-related methods here (e.g., getUser, updateUser, addCredits, etc.)
}
