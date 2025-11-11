// backend/src/identity/service.ts
import { BadRequestError } from "../shared/errors";
import * as repo from "./repository";
import type { Org, User } from "./types";

export async function listAllOrgs(): Promise<Org[]> {
  return repo.listOrgs();
}

export async function fetchOrg(orgId: string): Promise<Org> {
  const org = await repo.getOrgById(orgId);
  if (!org) throw new BadRequestError("Org not found");
  return org;
}

export async function createNewOrg(name: string): Promise<Org> {
  if (!name.trim()) {
    throw new BadRequestError("Org name is required");
  }
  return repo.createOrg(name.trim());
}

export async function getOrgUsers(orgId: string): Promise<User[]> {
  return repo.listUsersByOrg(orgId);
}
