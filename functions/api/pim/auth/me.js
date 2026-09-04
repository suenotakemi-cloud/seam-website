// GET /api/pim/auth/me → 今のアカウント（トークンの生存確認にも使う）
import { json, publicAccount } from '../_lib.js';

export async function onRequestGet({ data }) {
  return json({ ok: true, account: publicAccount(data.account), admin: !!data.isAdmin });
}
