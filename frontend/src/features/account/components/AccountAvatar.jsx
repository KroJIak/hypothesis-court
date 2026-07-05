import { useEffect, useState } from "react";

import { getApiAssetUrl } from "../../../api/baseUrl";
import { getDisplayName } from "../utils/getDisplayName";
import { getAccountInitials } from "../utils/getAccountInitials";

export function AccountAvatar({
  user,
  avatarUrl,
  accessToken = null,
  className = "",
  imageClassName = "",
  fallbackClassName = "",
}) {
  const displayName = getDisplayName(user);
  const initials = getAccountInitials(user);
  const resolvedAvatarUrl = getApiAssetUrl(avatarUrl);
  const [hasImageError, setHasImageError] = useState(false);
  const [authorizedAvatarUrl, setAuthorizedAvatarUrl] = useState(null);

  useEffect(() => {
    setHasImageError(false);
    setAuthorizedAvatarUrl(null);

    if (!resolvedAvatarUrl || !accessToken || /^(data:|blob:)/.test(resolvedAvatarUrl)) {
      return undefined;
    }

    const controller = new AbortController();
    let objectUrl = null;

    fetch(resolvedAvatarUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Avatar image is unavailable.");
        }

        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setAuthorizedAvatarUrl(objectUrl);
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setHasImageError(true);
        }
      });

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [accessToken, resolvedAvatarUrl]);

  const imageUrl = authorizedAvatarUrl ?? (
    !accessToken || /^(data:|blob:)/.test(resolvedAvatarUrl ?? "") ? resolvedAvatarUrl : null
  );

  return (
    <span className={`account-avatar ${className}`.trim()}>
      {imageUrl && !hasImageError ? (
        <img
          className={`account-avatar__image ${imageClassName}`.trim()}
          src={imageUrl}
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
