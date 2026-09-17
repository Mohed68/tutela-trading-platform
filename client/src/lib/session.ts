/** Legacy import compatibility only. Authority is server-resolved. */
export type UserRole="trader";
export interface AuthState{loggedIn:false;role:"trader";verified:false}
export function getAuth():AuthState{return {loggedIn:false,role:"trader",verified:false};}
export function setUserRole():never{throw new Error("CLIENT_AUTHORITY_RETIRED");}
export function isVerified():false{return false;}
export function hasRole():false{return false;}
export function requireVerified():false{return false;}
export function requireRole():false{return false;}
export function canAccessRoute():false{return false;}
