export function buildAccountProfile(user) {
  return {
    avatarUrl: typeof user?.avatar_url === "string" ? user.avatar_url : null,
  };
}
