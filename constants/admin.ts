// Admin identity. PocketBirds admins (Alex + Victoria) gate the global-first
// VERIFICATION action (confirming that a "first on Pocket Birds" claim is a
// real, photographed sighting and not a joke log). Hardcoded by uid so there's
// no Firestore bootstrap and no client-settable `isAdmin` flag to
// privilege-escalate against. The matching check lives in firestore.rules
// (keep the two lists in sync). Endgame is multi-person consensus — when that
// ships, swap this for a real role/verifier model
// (see project_global_first_verification).

export const ADMIN_UIDS = [
  'ZerkNpeAERSwmptlrPeboR5TASs2', // Alex (akeats97@gmail.com)
  'bvorXp0fC1QmhiUQM4ssoQcsodr1', // Victoria (vmvickymin@gmail.com)
] as const;

export function isAdminUid(uid?: string | null): boolean {
  return !!uid && (ADMIN_UIDS as readonly string[]).includes(uid);
}
