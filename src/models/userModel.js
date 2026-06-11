import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    apiKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    monthlyBudget: {
      type: Number,
      required: true,
      default: 5.0,
    },
    costThisMonth: {
      type: Number,
      required: true,
      default: 0.0,
    },
    tokensUsedThisMonth: {
      type: Number,
      required: true,
      default: 0,
    },
    rateLimitPerMinute: {
      type: Number,
      required: true,
      default: 60,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    resetBudgetDate: {
      type: Date,
      required: true,
      default: () => {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        return date;
      },
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.methods.checkAndResetBudget = async function () {
  const now = new Date();

  if (now >= this.resetBudgetDate) {
    this.costThisMonth = 0.0;
    this.tokensUsedThisMonth = 0;

    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    this.resetBudgetDate = nextReset;

    await this.save();
  }
};

UserSchema.methods.isOverBudget = function (estimatedCost) {
  return this.costThisMonth + estimatedCost > this.monthlyBudget;
};

export default mongoose.model('User', UserSchema);