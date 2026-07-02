import { useEffect, useState } from "react";

import { getWorkspaceScene } from "../api/getWorkspaceScene";

export function useWorkspaceScene() {
  const [state, setState] = useState({
    status: "loading",
    data: null,
  });

  useEffect(() => {
    let isMounted = true;

    getWorkspaceScene()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setState({
          status: "success",
          data,
        });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setState({
          status: "error",
          data: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
