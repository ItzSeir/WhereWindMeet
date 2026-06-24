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

const WEEKDAY_MAP = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function readValue(slot, members, keys) {
  const firstMember = Array.isArray(members) ? members[0] : null;

  for (const key of keys) {
    if (slot && slot[key] !== undefined && slot[key] !== null && slot[key] !== "") {
      return slot[key];
    }

    if (firstMember && firstMember[key] !== undefined && firstMember[key] !== null && firstMember[key] !== "") {
      return firstMember[key];
    }
  }

  return null;
}

function getMalaysiaDateId() {
  const now = new Date();
  const malaysia = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
  return `${malaysia.getFullYear()}-${String(malaysia.getMonth() + 1).padStart(2, "0")}-${String(malaysia.getDate()).padStart(2, "0")}`;
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
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${String(hour).padStart(2, "0")}:${minuteStr.padStart(2, "0")}${suffix}`;
}

function cleanType(rawType = "普通") {
  return String(rawType).replace(/團$/g, "");
}

function getTeamType(slot, members = []) {
  return cleanType(readValue(slot, members, ["teamType", "type", "activityType"]) || "普通");
}

function getTeamSize(slot, members = []) {
  const size = Number(readValue(slot, members, ["teamSize", "size", "teamSizeValue"]));
  if (Number.isFinite(size) && size > 0) return size;
  return members.length > 5 ? 10 : 10;
}

function getRoleCount(members = []) {
  return {
    dps: members.filter((m) => m.role === "輸出").length,
    tank: members.filter((m) => m.role === "承傷").length,
    heal: members.filter((m) => m.role === "治療").length,
  };
}

function getLeaderName(members = []) {
  return members[0]?.name || "隊長";
}

function getTowerDifficulty(slot, members = []) {
  return readValue(slot, members, [
    "towerDifficulty",
    "difficulty",
    "towerMode",
    "towerLevelDifficulty",
  ]) || "未設定難度";
}

function getTowerFloor(slot, members = []) {
  const start = readValue(slot, members, [
    "towerFloorStart",
    "towerStartFloor",
    "startTowerFloor",
    "floorStart",
    "startFloor",
    "towerStart",
    "fromFloor",
    "floorFrom",
  ]);

  const end = readValue(slot, members, [
    "towerFloorEnd",
    "towerEndFloor",
    "endTowerFloor",
    "floorEnd",
    "endFloor",
    "towerEnd",
    "toFloor",
    "floorTo",
  ]);

  if (start !== null && end !== null) {
    if (String(start) === String(end)) return `${start}層`;
    return `${start}-${end}層`;
  }

  const single = readValue(slot, members, [
    "towerFloor",
    "selectedTowerFloor",
    "floor",
    "level",
  ]);

  if (single !== null) return `${single}層`;

  const size = getTeamSize(slot, members);
  if (size === 5) return "1-5層";
  if (size === 10) return "1-10層";

  return "未設定層數";
}

function getTeamLabel(slot, members = []) {
  const size = getTeamSize(slot, members);
  const type = getTeamType(slot, members);

  if (type === "爬塔") return `${size}人｜爬塔`;
  return `${size}人｜${type}團`;
}

function getSlotText(team) {
  const { slot, members } = team;

  const count = members.length;
  const max = getTeamSize(slot, members);
  const role = getRoleCount(members);
  const leader = getLeaderName(members);
  const type = getTeamType(slot, members);
  const time = readValue(slot, members, ["time"]) || "";

  const lines = [
    `> **${formatTime(time)}｜${getTeamLabel(slot, members)}**`,
  ];

  if (type === "爬塔") {
    lines.push(`> 難度：**${getTowerDifficulty(slot, members)}**`);
    lines.push(`> 層數：**${getTowerFloor(slot, members)}**`);
  }

  lines.push(`> 開團：**${leader}**`);
  lines.push(`> 輸出 ${role.dps}｜承傷 ${role.tank}｜治療 ${role.heal} ｜ 👥 \`${count}/${max}\``);

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

  snap.forEach((doc) => {
    const dateId = doc.id;
    const data = doc.data();
    const slots = Array.isArray(data.slots) ? data.slots : [];

    slots.forEach((slot) => {
      const members = Array.isArray(slot.members) ? slot.members : [];
      if (members.length === 0) return;
      allTeams.push({ dateId, slot, members });
    });
  });

  allTeams.sort((a, b) => {
    const dateCompare = a.dateId.localeCompare(b.dateId);
    if (dateCompare !== 0) return dateCompare;

    const timeA = readValue(a.slot, a.members, ["time"]) || "";
    const timeB = readValue(b.slot, b.members, ["time"]) || "";
    return String(timeA).localeCompare(String(timeB));
  });

  const groupedByDate = {};

  allTeams.forEach((team) => {
    if (!groupedByDate[team.dateId]) groupedByDate[team.dateId] = [];
    groupedByDate[team.dateId].push(team);
  });

  let description = "";

  if (allTeams.length === 0) {
    description = "今天暫時沒有已報名的未來隊伍。";
  } else {
    Object.keys(groupedByDate).sort().forEach((dateId) => {
      const teamsText = groupedByDate[dateId]
        .map((team) => getSlotText(team))
        .join("\n\n");

      description += `## ${formatDateTitle(dateId)}\n\n${teamsText}\n\n`;
    });
  }

  if (description.length > 3800) {
    description = description.slice(0, 3600) + "\n\n隊伍太多，請到報名頁查看完整列表。";
  }

  await sendDiscord({
    embeds: [
      {
        title: "今日副本招募",
        description,
        color: 7248127,
        fields: [
          {
            name: "報名連結",
            value: `[點此進入報名頁](${SITE_URL})`,
            inline: false,
          },
        ],
        footer: {
          text: "夢回花深處｜每日自動公告",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
