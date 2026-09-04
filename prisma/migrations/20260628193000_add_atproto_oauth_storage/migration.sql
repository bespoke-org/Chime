-- CreateTable
CREATE TABLE "AtprotoOAuthState" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtprotoOAuthState_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AtprotoOAuthSession" (
    "sub" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtprotoOAuthSession_pkey" PRIMARY KEY ("sub")
);

-- CreateIndex
CREATE INDEX "AtprotoOAuthState_expiresAt_idx" ON "AtprotoOAuthState"("expiresAt");
