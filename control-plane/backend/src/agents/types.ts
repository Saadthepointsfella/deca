export type Agent = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  model_key: string | null;
  created_at: Date;
};
