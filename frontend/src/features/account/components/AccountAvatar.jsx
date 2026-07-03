import { getDisplayName } from "../utils/getDisplayName";
import { getAccountInitials } from "../utils/getAccountInitials";

export function AccountAvatar({
  user,
  avatarDataUrl,
  className = "",
  imageClassName = "",
  fallbackClassName = "",
}) {
  const displayName = getDisplayName(user);
  const initials = getAccountInitials(user);

  return (
    <span className={`account-avatar ${className}`.trim()}>
      {avatarDataUrl ? (
        <img className={`account-avatar__image ${imageClassName}`.trim()} src={avatarDataUrl} alt={displayName} />
      ) : (
        <span className={`account-avatar__fallback ${fallbackClassName}`.trim()} aria-hidden="true">
          {initials}
        </span>
      )}
    </span>
  );
}
