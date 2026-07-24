export function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export function licensePrivateKey() {
  return requiredEnv("LICENSE_PRIVATE_KEY").replace(/\\n/g, "\n");
}

export function licensePublicKey() {
  return process.env.LICENSE_PUBLIC_KEY?.replace(/\\n/g, "\n");
}

export function licenseKeyId() {
  return process.env.LICENSE_KEY_ID || "sarvaone-license-key-v1";
}

export function validateConfig() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  requiredEnv("DATABASE_URL");
  requiredEnv("JWT_SECRET");
  requiredEnv("API_KEY");
  requiredEnv("LICENSE_PRIVATE_KEY");
  requiredEnv("MACHINE_ID_HASH_SECRET");
}
