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

function getRoleCount(members = []) {
  return {
    dps: members.filter(m => m.role === "輸出").length,
    tank: members.filter(m => m.role === "承傷").length,
    heal: members.filter(m => m.role === "治療").length,
  };
}

function getMaxSize(slot) {
  const size = Number(slot.teamSize || slot.size || slot.teamSizeValue);
  return Number.isFinite(size) && size > 0 ? size : 10;
}

function getTeamType(slot) {
  return slot.teamType || slot.type || slot.activityType || "普通";
}

function getTeamSize(slot) {
  return slot.teamSize || slot.size || slot.teamSizeValue || "？";
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

function getTeamLabel(slot) {
  const size = getTeamSize(slot);
  const type = getTeamType(slot);

  if (type === "爬塔") {
    return `${size}人｜爬塔`;
  }

  return `${size}人｜${type}團`;
}

function getLeaderName(members = []) {
  return members[0]?.name || "隊長";
}

function getSlotLine(team) {
  const { slot, members } = team;

  const count = members.length;
  const max = getMaxSize(slot);
  const role = getRoleCount(members);
  const leader = getLeaderName(members);
  const type = getTeamType(slot);

  const header = `【${getTeamLabel(slot)}】隊伍#${slot.instance || 1}　${formatTime(slot.time)}`;

  const roleLine = `輸出 ${role.dps}｜承傷 ${role.tank}｜治療 ${role.heal}　${count}/${max}`;
  const leaderLine = `申請 ${leader} 隊伍`;

  if (type === "爬塔") {
    const difficulty = getTowerDifficulty(slot);
    const floor = getTowerFloor(slot);

    return [
      header,
      `難度：${difficulty}｜層數：${floor}`,
      roleLine,
      leaderLine,
    ].join("\n");
  }

  return [
    header,
    roleLine,
    leaderLine,
  ].join("\n");
}

async function main() {
  const snap = await db.collection("schedule").get();

  const allTeams = [];

  snap.forEach(doc => {
    const dateId = doc.id;
    const data = doc.data();
    const slots = Array.isArray(data.slots) ? data.slots : [];

    slots.forEach(slot => {
      const members = Array.isArray(slot.members) ? slot.members : [];
      if (members.length === 0) return;

      allTeams.push({
        dateId,
        slot,
        members,
      });
    });
  });

  allTeams.sort((a, b) => {
    const dateCompare = a.dateId.localeCompare(b.dateId);
    if (dateCompare !== 0) return dateCompare;

    const timeA = a.slot.time || "";
    const timeB = b.slot.time || "";
    return timeA.localeCompare(timeB);
  });

  let description = "";

  if (allTeams.length === 0) {
    description = "目前沒有任何已報名的隊伍。";
  } else {
    const groupedByDate = {};

    allTeams.forEach(team => {
      if (!groupedByDate[team.dateId]) groupedByDate[team.dateId] = [];
      groupedByDate[team.dateId].push(team);
    });

    description = Object.keys(groupedByDate)
      .sort()
      .map(dateId => {
        const lines = groupedByDate[dateId].map(team => getSlotLine(team));
        return `**${formatDateTitle(dateId)}**\n${lines.join("\n\n")}`;
      })
      .join("\n\n");
  }

  if (description.length > 3800) {
    description =
      description.slice(0, 3600) +
      "\n\n……隊伍太多，請到報名頁查看完整列表。";
  }

  await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: "📢 目前所有已報名隊伍",
          description,
          color: 7248127,
          footer: {
            text: "夢回花深處｜每日自動公告",
          },
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
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
