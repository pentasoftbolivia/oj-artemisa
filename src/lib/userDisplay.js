export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

export const resolveUserDisplayName = (meta = {}) => {
  const raw = meta?.full_name ?? meta?.name ?? meta?.display_name;
  return String(raw || "").trim();
};

export const buildUserDisplayMap = (users = []) => {
  const map = {};
  users.forEach((u) => {
    const email = normalizeEmail(u.email);
    if (!email) return;
    const name =
      String(u.display_name || "").trim() || resolveUserDisplayName(u.user_meta);
    map[email] = name || email;
  });
  return map;
};

export const getUserDisplayName = (map = {}, email) => {
  const key = normalizeEmail(email);
  return map[key] || email;
};