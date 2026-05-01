export async function auth() {
  return {
    userId: null,
    sessionClaims: null,
  };
}

export async function clerkClient() {
  return {
    users: {
      getUser: async () => ({
        emailAddresses: [],
        primaryEmailAddressId: null,
        firstName: null,
        lastName: null,
      }),
    },
  };
}

export function clerkMiddleware() {
  return function middleware() {};
}
