import User, { IUser } from "../models/user.model";
import crypto from "crypto";

interface RegisterUserData {
  whatsappNumber: string;
  name: string;
  referredBy?: string; // optional referral code
  preferredStates?: string[];
  preferredDistricts?: string[];
}

// Helper to generate random unique referral code
const generateReferralCode = (): string => {
  return crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars hex uppercase
};

export const registerUser = async (
  userData: RegisterUserData
): Promise<IUser> => {
  const {
    whatsappNumber,
    name,
    referredBy,
    preferredStates,
    preferredDistricts,
  } = userData;

  // Check if user already exists
  const existingUser = await User.findOne({ whatsappNumber });
  if (existingUser) {
    throw new Error("User with this WhatsApp number already registered");
  }

  // Generate unique referral code for new user
  let referralCode: string = "";
  let isUnique = false;
  while (!isUnique) {
    referralCode = generateReferralCode();
    const exists = await User.findOne({ referralCode });
    if (!exists) isUnique = true;
  }

  // Prepare new user data
  const newUserData: Partial<IUser> = {
    whatsappNumber,
    name,
    subscriptionStatus: "free",
    subscriptionPlan: null,
    preferredStates: preferredStates ?? ["Jharkhand"],
    preferredDistricts: preferredDistricts ?? [],
    referralCode,
    credits: 0,
    messagingLogs: [],
  };

  // Referral credit logic - if valid referredBy code found, add 20 credits to referrer
  if (referredBy) {
    const referrer = await User.findOne({ referralCode: referredBy });
    if (referrer) {
      referrer.credits += 20; // initial referral bonus
      await referrer.save();
      // Store who referred this user
      newUserData.referredBy = referredBy;
    }
  }

  // Save new user
  const newUser = new User(newUserData);
  await newUser.save();

  return newUser;
};
