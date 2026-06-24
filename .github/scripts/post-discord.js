const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

const WEBHOOK = process.env.DISCORD_WEBHOOK;
const SITE_URL = "https://itzseir.github.io/WhereWindMeet/PVERegistration.html";

function getMalaysiaDate() {
  const now = new Date();
  const malaysia = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
  const y = malaysia.getFullYear();
  const m = String(malaysia.getMonth() + 1).padStart(2, "0");
  const d = String(malaysia.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getRoleCount(members = []) {
  return {
    dps: members.filter(m => m.role === "輸出").length,
    tank: members.filter(m => m.role === "承傷").length,
    heal: members.filter(m => m.role === "治療").length,
  };
}

function slotTitle(slot) {
  const size = slot.teamSize || slot.size || "？";
  const type = slot.teamType || slot.type || "普通";
  const tower = slot.towerText || slot.floorText || slot.towerLevel || "";

  if (type === "爬塔" && tower) {
    return `${size}人｜爬塔｜${tower}`;
  }

  return `${size}人｜${type}`;
}

async function main() {
  const dateId = getMalaysiaDate();

  const snap = await db.collection("schedule").doc(dateId).get();

  if (!snap.exists) {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `📢 今日俠境招募\n\n📅 ${dateId}\n\n今天暫時沒有隊伍。\n\n🔗 ${SITE_URL}`,
      }),
    });
    return;
  }

  const data = snap.data();
  const slots = Array.isArray(data.slots) ? data.slots : [];

  const activeSlots = slots.filter(slot => {
    const members = Array.isArray(slot.members) ? slot.members : [];
    return members.length > 0;
  });

  let description = "";

  if (activeSlots.length === 0) {
    description = "今天暫時沒有已報名的隊伍。";
  } else {
    description = activeSlots.map(slot => {
      const members = Array.isArray(slot.members) ? slot.members : [];
      const count = members.length;
      const max = Number(slot.teamSize || slot.size || 10);
      const role = getRoleCount(members);

      return [
        `**${slot.time || "未設定時間"}｜${slotTitle(slot)}**`,
        `人數：${count}/${max}`,
        `輸出 ${role.dps}｜承傷 ${role.tank}｜治療 ${role.heal}`,
      ].join("\n");
    }).join("\n\n");
  }

  await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: "📢 今日副本招募",
          description,
          color: 7248127,
          fields: [
            {
              name: "日期",
              value: dateId,
              inline: true,
            },
            {
              name: "報名連結",
              value: `[點此進入報名頁](${SITE_URL})`,
              inline: false,
            },
          ],
          footer: {
            text: "夢回花深處｜每日自動公告",
          },
        },
      ],
    }),
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
