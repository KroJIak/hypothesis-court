export function getDisplayName(user) {
  const firstName = user?.first_name?.trim();
  const lastName = user?.last_name?.trim();

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }

  if (firstName) {
    return firstName;
  }

  return user?.username ?? "username";
}
