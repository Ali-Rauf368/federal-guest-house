/** Letterhead for printed bills. Set these in apps/web/.env (see .env.example), then rebuild. */
export const ORG = {
  name: import.meta.env.VITE_ORG_NAME || "Federal Guest House",
  contact: [import.meta.env.VITE_ORG_ADDRESS, import.meta.env.VITE_ORG_PHONE, import.meta.env.VITE_ORG_TAX_NUMBER].filter(Boolean).join(" · "),
};
