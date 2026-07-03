import { getApiAssetUrl } from "../../../api/baseUrl";
import { getDisplayName } from "../utils/getDisplayName";
import { getAccountInitials } from "../utils/getAccountInitials";

export function AccountAvatar({
  user,
  avatarUrl,
  className = "",
  imageClassName = "",
  fallbackClassName = "",
}) {
  const displayName = getDisplayName(user);
  const initials = getAccountInitials(user);
  const resolvedAvatarUrl = getApiAssetUrl(avatarUrl);

  return (
    <span className={`account-avatar ${className}`.trim()}>
      {resolvedAvatarUrl ? (
        <img className={`account-avatar__image ${imageClassName}`.trim()} src={resolvedAvatarUrl} alt={displayName} />
      ) : (
        <span className={`account-avatar__fallback ${fallbackClassName}`.trim()} aria-hidden="true">
          {initials}
        </span>
      )}
    </span>
  );
}
