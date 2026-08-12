import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildUserDisplayMap, getUserDisplayName } from "@/lib/userDisplay";

export const useUserDisplayNames = () => {
  const [map, setMap] = useState({});

  useEffect(() => {
    let isMounted = true;
    supabase
      .rpc("get_user_display_names")
      .then(({ data, error }) => {
        if (isMounted && !error && data) {
          setMap(buildUserDisplayMap(data));
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const getDisplayName = useCallback(
    (email) => getUserDisplayName(map, email),
    [map],
  );

  return { getDisplayName, userDisplayMap: map };
};