import "express-session";
import type { PrivilegedSessionSecurityContext } from "./session-assurance/contracts.js";

declare module "express-session" {
  interface SessionData {
    demoAccessGrantId?: string;
    demoSessionId?: string;
    privilegedSecurityContext?: PrivilegedSessionSecurityContext;
  }
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      profileImageUrl: string | null;
      claims: {
        sub: string;
        email: string | null;
        first_name: string | null;
        last_name: string | null;
        profile_image_url: string | null;
      };
    }
  }
}

export {};
