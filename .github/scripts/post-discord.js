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
  const raw = slot.teamSize || slot.size || slot.teamSizeValue;

  const size = Number(raw);
  if (Number.isFinite(size) && size > 0) return size;

  // 舊資料沒有 teamSize，用人數推斷
  if (members.length > 5) return 10;
  return 10;
}

function getMaxSize(slot, members = []) {
  return getTeamSize(slot, members);
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
  return (
    slot.difficulty ||
    slot.towerDifficulty ||
    slot.towerMode ||
    slot.towerLevelDifficulty ||
    "未設定難度"
  );
}

function getTowerFloor(slot) {
  const start =
    slot.floorStart ||
    slot.startFloor ||
    slot.towerStart ||
    slot.fromFloor ||
    slot.floorFrom;

  const end =
    slot.floorEnd ||
    slot.endFloor ||
    slot.towerEnd ||
    slot.toFloor ||
    slot.floorTo;

  if (start && end) {
    if (String(start) === String(end)) return `${start}層`;
    return `${start}層 - ${end}層`;
  }

  return (
    slot.floorText ||
    slot.towerText ||
    slot.towerLevel ||
    slot.floor ||
    slot.level ||
    "未設定層數"
  );
}

function getTeamLabel(slot, members = []) {
  const size = getTeamSize(slot, members);
  const type = getTeamType(slot);

  if (type === "爬塔") {
    return `${size}人｜爬塔`;
  }

  return `${size}人｜${type}團`;
}

function getStatus(count, max) {
  if (count >= max) return "已滿";
  return "招募中";
}

function getSlotText(team) {
  const { slot, members } = team;

  const count = members.length;
  const max = getMaxSize(slot, members);
  const role = getRoleCount(members);
  const leader = getLeaderName(members);
  const type = getTeamType(slot);
  const status = getStatus(count, max);

  const title = `**${formatTime(slot.time)}｜${getTeamLabel(slot, members)}｜隊伍#${slot.instance || 1}**`;

  const lines = [
    title,
    `狀態：${status}　人數：${count}/${max}`,
    `職業：輸出 ${role.dps}｜承傷 ${role.tank}｜治療 ${role.heal}`,
  ];

  if (type === "爬塔") {
    lines.push(`爬塔：${getTowerDifficulty(slot)}｜${getTowerFloor(slot)}`);
  }

  lines.push(`申請：${leader} 隊伍`);

  return lines.join("\n");
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
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "📢 副本招募公告",
            description: "目前沒有任何已報名的未來隊伍。",
            color: 7248127,
            footer: { text: "夢回花深處｜每日自動公告" },
            timestamp: new Date().toISOString(),
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: "前往副本報名",
                url: SITE_URL,
              },
            ],
          },
        ],
      }),
    });
    return;
  }

  const groupedByDate = {};
  allTeams.forEach(team => {
    if (!groupedByDate[team.dateId]) groupedByDate[team.dateId] = [];
    groupedByDate[team.dateId].push(team);
  });

  const embeds = Object.keys(groupedByDate)
    .sort()
    .slice(0, 8)
    .map((dateId, index) => {
      const teams = groupedByDate[dateId];

      let description = teams.map(getSlotText).join("\n\n");

      if (description.length > 3800) {
        description = description.slice(0, 3600) + "\n\n……隊伍太多，請到報名頁查看完整列表。";
      }

      return {
        title: index === 0 ? "📢 副本招募公告" : " ",
        description: `### ${formatDateTitle(dateId)}\n${description}`,
        color: 7248127,
        footer: index === 0 ? { text: "夢回花深處｜每日自動公告" } : undefined,
        timestamp: index === 0 ? new Date().toISOString() : undefined,
      };
    });

  await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds,
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "前往副本報名",
              url: SITE_URL,
            },
          ],
        },
      ],
    }),
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
