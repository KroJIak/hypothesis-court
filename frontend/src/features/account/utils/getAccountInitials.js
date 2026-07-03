export function getAccountInitials(user) {
  const firstName = user?.first_name?.trim() ?? "";
  const lastName = user?.last_name?.trim() ?? "";

  if (firstName) {
    return `${firstName[0]}${lastName ? lastName[0] : ""}`.toUpperCase();
  }

  const username = user?.username?.trim() ?? "";

  if (!username) {
    return "U";
  }

  const usernameParts = username
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (usernameParts.length >= 2) {
    return usernameParts
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  return username.slice(0, 2).toUpperCase();
}
