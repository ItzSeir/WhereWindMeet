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
const SITE_URL = "https://itzseir.github.io/WhereWindMeet/PVERegistration";

const WEEKDAY_MAP = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function getMalaysiaDateId() {
  const now = new Date();
  const malaysia = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
  const y = malaysia.getFullYear();
  const m = String(malaysia.getMonth() + 1).padStart(2, "0");
  const d = String(malaysia.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateTitle(dateId) {
  const [y, m, d] = dateId.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${m}月${d}日（${WEEKDAY_MAP[date.getDay()]}）`;
}

function formatTime(time = "") {
  if (!time) return "未設定時間";

  const [hourStr, minuteStr = "00"] = String(time).split(":");
  let hour = Number(hourStr);
  const minute = minuteStr.padStart(2, "0");
  const suffix = hour >= 12 ? "PM" : "AM";

  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${String(hour).padStart(2, "0")}:${minute}${suffix}`;
}

function cleanType(rawType = "普通") {
  return String(rawType).replace(/團$/g, "");
}

function getTeamType(slot) {
  return cleanType(slot.teamType || slot.type || slot.activityType || "普通");
}

function getTeamSize(slot, members = []) {
  const size = Number(slot.teamSize || slot.size || slot.teamSizeValue);
  if (Number.isFinite(size) && size > 0) return size;
  return members.length > 5 ? 10 : 10;
}

function getRoleCount(members = []) {
  return {
    dps: members.filter(m => m.role === "輸出").length,
    tank: members.filter(m => m.role === "承傷").length,
    heal: members.filter(m => m.role === "治療").length,
  };
}

function getLeaderName(members = []) {
  return members[0]?.name || "隊長";
}

function getTowerDifficulty(slot) {
  return slot.difficulty || slot.towerDifficulty || slot.towerMode || "未設定難度";
}

function getTowerFloor(slot) {
  const start = slot.floorStart || slot.startFloor || slot.towerStart || slot.fromFloor || slot.floorFrom;
  const end = slot.floorEnd || slot.endFloor || slot.towerEnd || slot.toFloor || slot.floorTo;

  if (start && end) {
    if (String(start) === String(end)) return `${start}層`;
    return `${start}層 - ${end}層`;
  }

  return slot.floorText || slot.towerText || slot.towerLevel || slot.floor || slot.level || "未設定層數";
}

function getTeamIcon(type) {
  if (type === "天賦") return "✨";
  if (type === "爬塔") return "🗼";
  return "⚔";
}

function getTeamLabel(slot, members = []) {
  const size = getTeamSize(slot, members);
  const type = getTeamType(slot);

  if (type === "爬塔") return `${size}人｜爬塔`;
  return `${size}人｜${type}團`;
}

function getStatusText(count, max) {
  return count >= max ? "已滿員" : "招募中";
}

function getSlotText(team) {
  const { slot, members } = team;

  const count = members.length;
  const max = getTeamSize(slot, members);
  const role = getRoleCount(members);
  const leader = getLeaderName(members);
  const type = getTeamType(slot);
  const icon = getTeamIcon(type);
  const status = getStatusText(count, max);

  const lines = [
    `${icon} **${getTeamLabel(slot, members)}**`,
    `👑 __${leader} 開團__`,
    `🕒 ${formatTime(slot.time)}　｜　${status}`,
    `👥 **${count}/${max}**`,
    `輸出 **${role.dps}**｜承傷 **${role.tank}**｜治療 **${role.heal}**`,
  ];

  if (type === "爬塔") {
    lines.splice(2, 0, `難度：**${getTowerDifficulty(slot)}**｜層數：**${getTowerFloor(slot)}**`);
  }

  return lines.join("\n");
}

async function sendDiscord(payload) {
  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook failed: ${res.status} ${text}`);
  }
}

async function main() {
  const todayId = getMalaysiaDateId();

  const snap = await db
    .collection("schedule")
    .where(admin.firestore.FieldPath.documentId(), ">=", todayId)
    .get();

  const allTeams = [];

  snap.forEach(doc => {
    const dateId = doc.id;
    const data = doc.data();
    const slots = Array.isArray(data.slots) ? data.slots : [];

    slots.forEach(slot => {
      const members = Array.isArray(slot.members) ? slot.members : [];
      if (members.length === 0) return;

      allTeams.push({ dateId, slot, members });
    });
  });

  allTeams.sort((a, b) => {
    const dateCompare = a.dateId.localeCompare(b.dateId);
    if (dateCompare !== 0) return dateCompare;
    return String(a.slot.time || "").localeCompare(String(b.slot.time || ""));
  });

  if (allTeams.length === 0) {
    await sendDiscord({
      content:
        `# 📢 夢回花深處｜副本招募公告\n\n` +
        `目前沒有任何已報名的未來隊伍。\n\n` +
        `🔗 **副本報名：**\n${SITE_URL}`,
    });
    return;
  }

  const groupedByDate = {};
  allTeams.forEach(team => {
    if (!groupedByDate[team.dateId]) groupedByDate[team.dateId] = [];
    groupedByDate[team.dateId].push(team);
  });

  let content = "# 📢 夢回花深處｜副本招募公告\n\n";

  Object.keys(groupedByDate)
    .sort()
    .forEach(dateId => {
      content += `## 📅 ${formatDateTitle(dateId)}\n\n`;

      groupedByDate[dateId].forEach((team, index) => {
        content += getSlotText(team);

        if (index !== groupedByDate[dateId].length - 1) {
          content += "\n\n━━━━━━━━━━━━━━━━\n\n";
        } else {
          content += "\n\n";
        }
      });
    });

  content += `━━━━━━━━━━━━━━━━\n\n🔗 **副本報名：**\n${SITE_URL}`;

  if (content.length > 1900) {
    content =
      content.slice(0, 1750) +
      `\n\n……請到報名頁面報名和查看完整名單。\n\n🔗 ${SITE_URL}`;
  }

  await sendDiscord({ content });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
