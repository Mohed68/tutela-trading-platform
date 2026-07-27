import "express-session";

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
