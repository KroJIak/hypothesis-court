import { useEffect, useState } from "react";

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
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [resolvedAvatarUrl]);

  return (
    <span className={`account-avatar ${className}`.trim()}>
      {resolvedAvatarUrl && !hasImageError ? (
        <img
          className={`account-avatar__image ${imageClassName}`.trim()}
          src={resolvedAvatarUrl}
          alt={displayName}
          onError={() => setHasImageError(true)}
        />
      ) : (
        <span className={`account-avatar__fallback ${fallbackClassName}`.trim()} aria-hidden="true">
          {initials}
        </span>
      )}
    </span>
  );
}
