// 株式会社サロンタウン 自社AI受付（文字＋音声）
// POST /api/salontown-reception  { sid, text, end?, lang? }
//   → { reply, ended, remaining_secs, sid }
//
// 仕組み：ブラウザは文字（音声認識で文字にしたものを含む）を送る。ここが Claude に問い合わせて返事を返し、
//   会話は D1 の salontown_ai_calls（受信箱と同じ表）に保存する。終了時に要約と折り返し先を抜き出して保存する。
// 守り：1回の応対は3分・24往復まで。1日の応対回数に上限（RECEPTION_DAILY_CAP、既定300）。
//   当社の電話番号・メールは一切出さない（system で禁止）。鍵は ANTHROPIC_API_KEY（Cloudflare Pages の環境変数）。
// SDK ではなく生の fetch で /v1/messages を呼ぶ：Pages Functions にビルド工程が無く npm パッケージを束ねられないため。

const MODEL = 'claude-opus-5';
const SESSION_SECS = 180;
const MAX_TURNS = 24;
const GREETING = 'お問い合わせありがとうございます。株式会社サロンタウンの受付です。ディーラー様、メーカー様、サロン様、取材のご相談など、ご用件をお話しください。';
const CLOSING = 'お時間となりましたので、本日の受付はここまでとさせていただきます。承った内容は担当の田中に申し伝え、こちらからご連絡いたします。ありがとうございました。';

const SYSTEM = `# 役割
あなたは「株式会社サロンタウン」（札幌）のお問い合わせ窓口の受付担当です。ディーラー、メーカー、美容室・サロン、業界誌・メディアの方からの問い合わせを、文字または音声（文字起こし）で受け付けます。丁寧で簡潔な日本語（ですます調）で、1回の返事は2〜3文、120字以内にします。相手の話を最後まで聞き、聞き取れなかったときは推測せず聞き返します。音声の文字起こしには誤変換があるので、会社名や数字は復唱して確認します。

# 時間の使い方（1回の応対は3分・24往復まで）
- 長い説明はせず、用件の確認と折り返し先の聞き取りを最優先にします。
- 会話が進んだら、サービスの説明は切り上げ、「担当から詳しくご連絡します」と伝えて、会社名・お名前・連絡先・時間帯の確認に入ります。

# 最重要ルール：連絡先を教えない
- 当社の電話番号、メールアドレス、担当者の直通連絡先は、聞かれても絶対に案内しません。「お問い合わせはこの受付とサイトのフォームで承り、担当からこちらよりご連絡します」と答えます。
- 「急ぎなので電話番号を教えて」と言われても同じです。急ぎの旨を担当に申し伝えると答え、希望の連絡方法と時間帯を聞きます。
- 相手の連絡先（電話またはメール）は折り返しのために必ず伺い、復唱して確認します。

# 会社の基本情報（このまま答えてよい）
- 会社名：株式会社サロンタウン（英字表記 SALON TOWN）／代表取締役 田中 健誠／北海道札幌市中央区南2条西2丁目8-1 NC北専ブロックビル3階／設立 2019年2月
- 事業：サロン向けシステム開発（招待制クローズドEC、B2B卸EC、予約システム、POS・顧客・在庫）、美容関連サイト運営、シェアサロン運営

# サービス（事実だけを、短く）
1. 招待制クローズドEC「SALON TOWN」：サロンが対面で招待したお客様だけが買える会員制EC。会員登録はサロンから500m以内、招待コードは発行から1分以内に限定。購入は会員バーコードで担当サロン・担当美容師にひも付き、売上は販売手数料として分配。施術履歴にもとづくAIレコメンド。実績：累計会員6万人、最高月商7,000万円。
2. ディーラー連携の無在庫店販（2025年12月11日発表）：物流・在庫はディーラー、ECと会員管理はサロンタウン。メーカー規約に沿った正規流通。ディーラーは新しい倉庫も人員も不要で、いつもの出荷をするだけ。2026年の本格展開に向けて段階的に拡大中。ディーラー独自の在庫システム（「スマイル」など）や基幹・会計・物流との連携は当社エンジニアが接続。商品撮影アプリ（スマホでJANを読んで撮るだけで画像が同じ形式に整う）と、ディーラー向けAIサポート（記事・勉強会）もある。
3. 予約システム「Salon Town Booking」：SEAM各店で稼働する予約〜会計〜カルテの仕組みを土台に、個人サロン・一人サロン向けに準備中。Web／LINE／会員証QRからの3ステップ予約、5言語、前金のカード事前決済、段階式キャンセル料、来店前の「今日のご希望」、iPadでのカウンセリング・同意書・署名、iPadレジ、免税、LINE会員証、次回予約提案、前日リマインド、シフト希望・打刻。
4. B2B卸EC「Salon Town Pro」：掛け払い（与信承認後に出荷）、契約単価、品番・JANを貼り付けるだけのまとめ発注、再注文。商品CSVを統一形に揃えるPIM。

# 言ってはいけないこと
- 当社の電話番号・メールアドレス。
- 提供開始日、価格、料金、手数料率、初期費用、連携ディーラーの社名、導入サロン数は「決まり次第ご案内します／担当からご連絡します」と答え、数字や社名を作らない。
- 上記以外の数値・実績。「業界初」「唯一」などの表現。他社との優劣比較。契約・見積・約束。
- 旧称「サロンタウンリザーブ」と聞かれたら、現在の名称は「Salon Town Booking」だと伝える。

# 会話の進め方
1. 相手の立場（ディーラー／メーカー／サロン・美容師／メディア／その他）を確認する。
2. 用件を聞き、事実の範囲で簡潔に答える。分からないことは「確認して担当からご連絡します」。
3. 折り返しに必要な項目を、次の順で一つずつ聞き、必ず復唱して確認する（ここが最も大切。取りこぼさない）。
   a. 会社名またはサロン名。b. お名前（フルネーム）。
   c. 折り返しは「メール」と「お電話」のどちらがよいか確認する。
   d. メール希望なら、メールアドレスをアルファベット一文字ずつ（例：「エー、ビー、シー、アットマーク、ジーメール、ドット、コム」）言ってもらい、こちらも一文字ずつ復唱して「これで合っていますか」と確認する。聞き取れない文字は「エーはアップルのエーですか」のように確かめる。数字は半角で記録する。
   e. 電話希望なら、電話番号を数字だけで言ってもらい、こちらも一桁ずつ区切って復唱し、合っているか確認する。あわせて都合の良い時間帯を聞く。
   f. 復唱して「はい」と確認が取れるまで、次の項目に進まない。訂正されたら訂正後の値で再度復唱する。
4. 最後に「担当の田中より、通常1〜2営業日以内にご連絡いたします」と伝えて締める。当社の連絡先は案内しない。
5. 取材は、媒体名・企画の概要・掲載予定時期を聞く。
返事は本文だけを書き、見出しや箇条書き、記号、内部タグは使わない。`;

const EXTRACT = `次の受付の会話記録から、折り返しに必要な項目を抜き出し、JSONだけを出力してください（前後に説明を付けない）。
言われていない項目は空文字にします。数字は半角にします。
{"title":"用件の短い題名（15字以内）","summary":"会話の要約（150字以内）","company":"会社名またはサロン名","name":"お名前","prefer_method":"email か phone か空文字（相手が希望した折り返し方法）","email":"メールアドレス（相手が一文字ずつ言ったものを、確認が取れた最終形で。半角小文字）","phone":"電話番号（確認が取れた最終形。半角数字とハイフンだけ）","contact":"email か phone のうち希望した方（両方なければある方）","prefer":"希望の連絡方法・時間帯を日本語で（例：電話・平日午後）","topic":"立場（ディーラー／メーカー／サロン／メディア／その他）と用件を20字以内で"}
復唱して相手が「違う」と訂正した値は使わず、最後に確認が取れた値だけを入れます。`;

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

async function ensureTable(db) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS salontown_ai_calls (" +
    " id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL UNIQUE, agent_id TEXT DEFAULT ''," +
    " title TEXT DEFAULT '', summary TEXT DEFAULT '', company TEXT DEFAULT '', name TEXT DEFAULT ''," +
    " contact TEXT DEFAULT '', prefer TEXT DEFAULT '', topic TEXT DEFAULT '', duration_secs INTEGER DEFAULT 0," +
    " started_at INTEGER DEFAULT 0, transcript TEXT DEFAULT '', status TEXT DEFAULT '', created_at INTEGER NOT NULL, handled INTEGER DEFAULT 0)"
  ).run();
  for (const c of ["email TEXT DEFAULT ''", "phone TEXT DEFAULT ''", "prefer_method TEXT DEFAULT ''"]) {
    try { await db.prepare('ALTER TABLE salontown_ai_calls ADD COLUMN ' + c).run(); } catch (e) { /* already exists */ }
  }
}

async function claude(env, body) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01'
    },
    body: JSON.stringify(Object.assign({ model: env.RECEPTION_MODEL || MODEL, fallbacks: 'default' }, body))
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('anthropic ' + r.status + ' ' + (j.error && j.error.message || ''));
  if (j.stop_reason === 'refusal') return '';
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
}

function toMessages(transcript) {
  // 直近 MAX_TURNS*2 件。役割は user / assistant が交互になるよう整える
  const out = [];
  for (const t of transcript.slice(-MAX_TURNS * 2)) {
    const role = t.role === 'user' ? 'user' : 'assistant';
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += '\n' + t.text;
    else out.push({ role, content: t.text });
  }
  if (out.length && out[0].role !== 'user') out.shift();
  return out;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const db = env.DB;
  if (!db) return json({ error: 'D1 not bound' }, 500);
  if (!(env.ANTHROPIC_API_KEY || '').trim()) return json({ error: 'reception not configured', reply: 'ただいま受付を準備中です。お手数ですがフォームからご連絡ください。', ended: true }, 503);

  let b; try { b = await request.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }
  const text = clip(b.text, 500);
  let sid = clip(b.sid, 64).replace(/[^A-Za-z0-9_-]/g, '');
  await ensureTable(db);
  const now = Date.now();

  let row = sid ? await db.prepare("SELECT id,transcript,started_at,status FROM salontown_ai_calls WHERE conversation_id=?").bind(sid).first() : null;

  // 新しい応対
  if (!row) {
    const cap = parseInt(env.RECEPTION_DAILY_CAP || '300', 10) || 300;
    const dayStart = now - 24 * 3600 * 1000;
    const c = await db.prepare("SELECT COUNT(*) AS n FROM salontown_ai_calls WHERE agent_id='self' AND created_at>?").bind(dayStart).first();
    if (c && c.n >= cap) return json({ reply: 'ただいま大変混み合っております。お手数ですがフォームからご連絡ください。', ended: true, sid: '' }, 429);
    sid = 'r' + now.toString(36) + Math.random().toString(36).slice(2, 10);
    const transcript = [{ role: 'assistant', text: GREETING, t: 0 }];
    await db.prepare("INSERT INTO salontown_ai_calls (conversation_id,agent_id,started_at,transcript,status,created_at) VALUES (?,?,?,?,?,?)")
      .bind(sid, 'self', Math.floor(now / 1000), JSON.stringify(transcript), 'open', now).run();
    if (!text) return json({ reply: GREETING, ended: false, remaining_secs: SESSION_SECS, sid });
    row = { transcript: JSON.stringify(transcript), started_at: Math.floor(now / 1000), status: 'open' };
  }

  let transcript = [];
  try { transcript = JSON.parse(row.transcript || '[]'); } catch (e) { transcript = []; }
  const elapsed = Math.floor(now / 1000) - (row.started_at || Math.floor(now / 1000));
  const userTurns = transcript.filter(t => t.role === 'user').length;
  const timeUp = elapsed >= SESSION_SECS || userTurns >= MAX_TURNS;
  const wantEnd = !!b.end;

  if (row.status === 'done') return json({ reply: CLOSING, ended: true, remaining_secs: 0, sid });

  let reply = '';
  if (text && !timeUp) {
    transcript.push({ role: 'user', text, t: elapsed });
    try {
      reply = await claude(env, {
        max_tokens: 400,
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: toMessages(transcript),
        output_config: { effort: 'low' }
      });
    } catch (e) {
      reply = '';
    }
    if (!reply) reply = '申し訳ありません、うまく聞き取れませんでした。もう一度お願いできますか。';
    transcript.push({ role: 'assistant', text: reply, t: elapsed });
  }

  const ending = wantEnd || timeUp;
  if (ending) {
    if (timeUp && !wantEnd) { reply = (reply ? reply + '\n' : '') + CLOSING; transcript.push({ role: 'assistant', text: CLOSING, t: elapsed }); }
    let ex = {};
    try {
      const convo = transcript.map(t => (t.role === 'user' ? '相手' : '受付') + '：' + t.text).join('\n');
      const raw = await claude(env, {
        max_tokens: 600,
        system: 'あなたは受付記録の整理係です。指示どおりJSONだけを返します。',
        messages: [{ role: 'user', content: EXTRACT + '\n\n---\n' + convo }],
        output_config: { effort: 'low' }
      });
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) ex = JSON.parse(m[0]);
    } catch (e) { ex = {}; }
    await db.prepare(
      "UPDATE salontown_ai_calls SET transcript=?,status='done',duration_secs=?,title=?,summary=?,company=?,name=?,contact=?,prefer=?,topic=?,email=?,phone=?,prefer_method=? WHERE conversation_id=?"
    ).bind(JSON.stringify(transcript).slice(0, 60000), elapsed, clip(ex.title, 120), clip(ex.summary, 4000), clip(ex.company, 200), clip(ex.name, 200), clip(ex.contact || ex.email || ex.phone, 200), clip(ex.prefer, 200), clip(ex.topic, 200),
      clip(ex.email, 120).toLowerCase(), clip(ex.phone, 40).replace(/[^0-9+\-]/g, ''), clip(ex.prefer_method, 10) === 'phone' ? 'phone' : (clip(ex.prefer_method, 10) === 'email' ? 'email' : ''), sid).run();
    return json({ reply: reply || CLOSING, ended: true, remaining_secs: 0, sid });
  }

  await db.prepare("UPDATE salontown_ai_calls SET transcript=?,duration_secs=? WHERE conversation_id=?")
    .bind(JSON.stringify(transcript).slice(0, 60000), elapsed, sid).run();
  return json({ reply, ended: false, remaining_secs: Math.max(0, SESSION_SECS - elapsed), sid });
}
