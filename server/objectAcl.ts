import { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

// The type of the access group.
export enum ObjectAccessGroupType {
  OWNER_ONLY = "owner_only",
  ADMIN_ONLY = "admin_only",
  VERIFIED_USERS = "verified_users"
}

// The logic user group that can access the object.
export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  id: string;
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

// The ACL policy of the object.
export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<ObjectAclRule>;
}

// Check if the requested permission is allowed based on the granted permission.
function isPermissionAllowed(
  requested: ObjectPermission,
  granted: ObjectPermission,
): boolean {
  // Users granted with read or write permissions can read the object.
  if (requested === ObjectPermission.READ) {
    return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
  }

  // Only users granted with write permissions can write the object.
  return granted === ObjectPermission.WRITE;
}

// The base class for all access groups.
abstract class BaseObjectAccessGroup implements ObjectAccessGroup {
  constructor(
    public readonly type: ObjectAccessGroupType,
    public readonly id: string,
  ) {}

  // Check if the user is a member of the group.
  public abstract hasMember(userId: string): Promise<boolean>;
}

// Owner-only access group
class OwnerOnlyAccessGroup extends BaseObjectAccessGroup {
  constructor(ownerId: string) {
    super(ObjectAccessGroupType.OWNER_ONLY, ownerId);
  }

  async hasMember(userId: string): Promise<boolean> {
    return userId === this.id;
  }
}

// Admin-only access group  
class AdminOnlyAccessGroup extends BaseObjectAccessGroup {
  constructor() {
    super(ObjectAccessGroupType.ADMIN_ONLY, "admin");
  }

  async hasMember(userId: string): Promise<boolean> {
    // In a real implementation, check if user has admin role
    // For now, return false to keep documents secure
    return false;
  }
}

// Verified users access group
class VerifiedUsersAccessGroup extends BaseObjectAccessGroup {
  constructor() {
    super(ObjectAccessGroupType.VERIFIED_USERS, "verified");
  }

  async hasMember(userId: string): Promise<boolean> {
    // In a real implementation, check if user is KYB verified
    // For now, return false to keep documents secure
    return false;
  }
}

function createObjectAccessGroup(
  group: ObjectAccessGroup,
): BaseObjectAccessGroup {
  switch (group.type) {
    case ObjectAccessGroupType.OWNER_ONLY:
      return new OwnerOnlyAccessGroup(group.id);
    case ObjectAccessGroupType.ADMIN_ONLY:
      return new AdminOnlyAccessGroup();
    case ObjectAccessGroupType.VERIFIED_USERS:
      return new VerifiedUsersAccessGroup();
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}

// Sets the ACL policy to the object metadata.
export async function setObjectAclPolicy(
  objectFile: File,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }

  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
    },
  });
}

// Gets the ACL policy from the object metadata.
export async function getObjectAclPolicy(
  objectFile: File,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await objectFile.getMetadata();
  const aclPolicy = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!aclPolicy) {
    return null;
  }
  return JSON.parse(aclPolicy as string);
}

// Checks if the user can access the object.
export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: File;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  // When this function is called, the acl policy is required.
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }

  // Public objects are always accessible for read.
  if (
    aclPolicy.visibility === "public" &&
    requestedPermission === ObjectPermission.READ
  ) {
    return true;
  }

  // Access control requires the user id.
  if (!userId) {
    return false;
  }

  // The owner of the object can always access it.
  if (aclPolicy.owner === userId) {
    return true;
  }

  // Go through the ACL rules to check if the user has the required permission.
  for (const rule of aclPolicy.aclRules || []) {
    const accessGroup = createObjectAccessGroup(rule.group);
    if (
      (await accessGroup.hasMember(userId)) &&
      isPermissionAllowed(requestedPermission, rule.permission)
    ) {
      return true;
    }
  }

  return false;
}