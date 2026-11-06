ALTER TABLE "Payment" ADD COLUMN "reversedAt" TIMESTAMP(3),
ADD COLUMN "reversedBy" TEXT,
ADD COLUMN "reversalNote" TEXT;
