export type ApiKey = {
  id: string;           // human id (ulid/uuid)
  org_id: string;
  name: string;
  secret_prefix: string;
  secret_hash: string;
  created_at: string;
  revoked_at: string | null;
};
