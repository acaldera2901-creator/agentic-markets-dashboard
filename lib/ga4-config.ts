const productionMeasurementId = "G-8XWQD5N6T7";
const configuredMeasurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim();

function resolveMeasurementId() {
  const isPreview = process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
  if (!configuredMeasurementId) return isPreview ? undefined : productionMeasurementId;
  if (isPreview && configuredMeasurementId === productionMeasurementId) return undefined;
  return /^G-[A-Z0-9]+$/.test(configuredMeasurementId) ? configuredMeasurementId : undefined;
}

export const GA_MEASUREMENT_ID = resolveMeasurementId();
