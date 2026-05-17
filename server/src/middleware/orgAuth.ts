import type { Types } from 'mongoose';
import { Organization, type IOrganization } from '../models/Organization.js';
import { Group, type IGroup } from '../models/Group.js';
import { Server, type IServer } from '../models/Server.js';
import { WhitelistEntry, type IWhitelistEntry } from '../models/WhitelistEntry.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { isValidObjectId } from '../utils/validators.js';
import { isAdminTier } from './roles.js';
import type { UserRole } from '../models/User.js';

export type OrgRole = 'owner' | 'admin' | 'moderator' | 'viewer';

const ORG_ROLE_LEVEL: Record<OrgRole, number> = {
  viewer: 0,
  moderator: 1,
  admin: 2,
  owner: 3,
};

export function getOrgRole(org: IOrganization, userId: string): OrgRole | null {
  if (org.ownerId.toString() === userId) return 'owner';
  const m = org.members.find((m) => m.userId.toString() === userId);
  return (m?.role as OrgRole | undefined) ?? null;
}

export function hasOrgRole(org: IOrganization, userId: string, minRole: OrgRole): boolean {
  const role = getOrgRole(org, userId);
  if (!role) return false;
  return ORG_ROLE_LEVEL[role] >= ORG_ROLE_LEVEL[minRole];
}

/**
 * Is this user a clan-leader (or deputy) of the given group?
 * Clan-leadership applies only to type:'clan' groups and is determined
 * solely by membership in `group.managers` — a list of SteamID64 strings.
 */
export function isClanManager(group: IGroup, steamId: string): boolean {
  if (group.type !== 'clan') return false;
  return group.managers.includes(steamId);
}

/**
 * Load an org by ID. Admin-tier system roles (owner/admin) and `root`-style
 * legacy callers bypass per-org checks. Manager-tier users need explicit
 * per-org membership at `minRole` or higher.
 */
export async function loadOrgForUser(
  orgId: unknown,
  userId: string,
  systemRole: UserRole,
  minRole: OrgRole
): Promise<IOrganization> {
  if (!isValidObjectId(orgId)) throw badRequest('Invalid orgId');
  const org = await Organization.findById(orgId);
  if (!org) throw notFound('Organization not found');
  if (systemRole === 'owner') return org;
  if (isAdminTier(systemRole)) return org; // admin can access any org they belong to; cross-org limited via member checks elsewhere
  if (!hasOrgRole(org, userId, minRole)) throw forbidden('Not authorized for this organization');
  return org;
}

/** Load a Group, checking either admin org access OR clan-manager access. */
export async function loadGroupForUser(
  groupId: unknown,
  userId: string,
  steamId: string,
  systemRole: UserRole,
  minRole: OrgRole
): Promise<{ group: IGroup; org: IOrganization }> {
  if (!isValidObjectId(groupId)) throw badRequest('Invalid group id');
  const group = await Group.findById(groupId);
  if (!group) throw notFound('Group not found');

  const org = await Organization.findById(group.orgId);
  if (!org) throw notFound('Organization not found');

  if (systemRole === 'owner' || isAdminTier(systemRole)) return { group, org };

  // Clan-manager fast path: if the user's SteamID is in the clan's managers, allow.
  if (isClanManager(group, steamId)) return { group, org };

  if (!hasOrgRole(org, userId, minRole)) throw forbidden('Not authorized');
  return { group, org };
}

/** Load a Server. Admin-tier only — clan-managers cannot touch servers. */
export async function loadServerForUser(
  serverId: unknown,
  userId: string,
  systemRole: UserRole,
  minRole: OrgRole
): Promise<{ server: IServer; org: IOrganization }> {
  if (!isValidObjectId(serverId)) throw badRequest('Invalid server id');
  const server = await Server.findById(serverId);
  if (!server) throw notFound('Server not found');
  const org = await loadOrgForUser(server.orgId.toString(), userId, systemRole, minRole);
  return { server, org };
}

/**
 * Load a WhitelistEntry. Admin-tier sees everything; clan-managers see only
 * entries in clans they manage.
 */
export async function loadEntryForUser(
  entryId: unknown,
  userId: string,
  steamId: string,
  systemRole: UserRole,
  minRole: OrgRole
): Promise<{ entry: IWhitelistEntry; org: IOrganization; group: IGroup }> {
  if (!isValidObjectId(entryId)) throw badRequest('Invalid entry id');
  const entry = await WhitelistEntry.findById(entryId);
  if (!entry) throw notFound('Entry not found');

  const group = await Group.findById(entry.groupId);
  if (!group) throw notFound('Group not found');

  const org = await Organization.findById(entry.orgId);
  if (!org) throw notFound('Organization not found');

  if (systemRole === 'owner' || isAdminTier(systemRole)) return { entry, org, group };
  if (isClanManager(group, steamId)) return { entry, org, group };
  if (!hasOrgRole(org, userId, minRole)) throw forbidden('Not authorized');
  return { entry, org, group };
}

/**
 * Find all clan-type groups in `orgId` where this SteamID is listed as a manager.
 * Used to scope listings ("show me only my clans' players").
 */
export async function findManagedClans(orgId: string, steamId: string): Promise<IGroup[]> {
  return Group.find({ orgId, type: 'clan', managers: steamId });
}

export type { IOrganization, IGroup, IServer, IWhitelistEntry, Types };
