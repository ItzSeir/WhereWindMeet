const admin = require("firebase-admin");

// ==========================================
// Configuration checking
// ==========================================

const REQUIRED_ENVIRONMENT_VARIABLES = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "DISCORD_WEBHOOK",
];

for (const variableName of REQUIRED_ENVIRONMENT_VARIABLES) {
  if (!process.env[variableName]) {
    throw new Error(
      `Missing required environment variable: ${variableName}`
    );
  }
}

// ==========================================
// Firebase initialization
// ==========================================

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(
      /\\n/g,
      "\n"
    ),
  }),
});

const db = admin.firestore();

const WEBHOOK = process.env.DISCORD_WEBHOOK;
const RUN_MODE = process.env.RUN_MODE || "daily";

const SITE_URL =
  "https://itzseir.github.io/WhereWindMeet/PVERegistration";

const WEEKDAY_MAP = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
];

// ==========================================
// Malaysia date helpers
// ==========================================

function getMalaysiaDateId() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year"
  )?.value;

  const month = parts.find(
    (part) => part.type === "month"
  )?.value;

  const day = parts.find(
    (part) => part.type === "day"
  )?.value;

  return `${year}-${month}-${day}`;
}

function formatDateTitle(dateId) {
  const [year, month, day] = dateId
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  const weekday = WEEKDAY_MAP[date.getUTCDay()];

  return `${month}月${day}日（${weekday}）`;
}

function formatTime(time = "") {
  if (!time) {
    return "未設定時間";
  }

  const [hourString, minuteString = "00"] =
    String(time).split(":");

  let hour = Number(hourString);

  if (!Number.isFinite(hour)) {
    return String(time);
  }

  const minute = String(minuteString).padStart(
    2,
    "0"
  );

  const suffix = hour >= 12 ? "PM" : "AM";

  hour %= 12;

  if (hour === 0) {
    hour = 12;
  }

  return `${String(hour).padStart(
    2,
    "0"
  )}:${minute}${suffix}`;
}

// ==========================================
// Team helpers
// ==========================================

function cleanType(rawType = "普通") {
  return String(rawType || "普通").replace(
    /團$/g,
    ""
  );
}

function getTeamType(slot) {
  return cleanType(
    slot.teamType ||
      slot.type ||
      slot.activityType ||
      "普通"
  );
}

function getTeamSize(slot, members = []) {
  const size = Number(
    slot.teamSize ??
      slot.size ??
      slot.teamSizeValue
  );

  if (Number.isFinite(size) && size > 0) {
    return size;
  }

  /*
   * Older Firestore records may not contain a team size.
   * A team containing more than five members is treated
   * as a 10-person team.
   */
  if (members.length > 5) {
    return 10;
  }

  /*
   * Change this default to 5 if most older records
   * without teamSize are five-person teams.
   */
  return 10;
}

function getRoleCount(members = []) {
  let dps = 0;
  let tank = 0;
  let heal = 0;

  const fakeHealers = [];

  members.forEach((member) => {
    const role = member.role;

    if (role === "輸出") {
      dps++;
    } else if (role === "承傷") {
      tank++;
    } else if (role === "治療") {
      heal++;
    } else if (role === "假奶") {
      fakeHealers.push(member);
    }
  });

  fakeHealers.forEach(() => {
    if (heal < 2) {
      heal++;
    } else {
      dps++;
    }
  });

  return {
    dps,
    tank,
    heal,
  };
}

function getLeaderName(members = []) {
  return members[0]?.name || "隊長";
}

function getTowerDifficulty(slot) {
  return (
    slot.towerDifficulty ??
    slot.difficulty ??
    slot.towerMode ??
    slot.towerLevelDifficulty ??
    "未設定難度"
  );
}

function getTowerFloor(slot, members = []) {
  const type = getTeamType(slot);

  if (type !== "爬塔") {
    return "";
  }

  const start = slot.towerFloorStart;
  const end = slot.towerFloorEnd;
  const single = slot.towerFloor;

  if (
    start !== null &&
    start !== undefined &&
    end !== null &&
    end !== undefined
  ) {
    if (String(start) === String(end)) {
      return `${start}層`;
    }

    return `${start}-${end}層`;
  }

  if (
    single !== null &&
    single !== undefined
  ) {
    return `${single}層`;
  }

  const size = getTeamSize(slot, members);

  return size === 5 ? "1-5層" : "1-10層";
}

function getSlotStatus(slot) {
  return (
    slot.status ||
    slot.slotStatus ||
    "準時"
  );
}

function getChangedTime(slot) {
  return (
    slot.changedTime ||
    slot.newTime ||
    slot.updatedTime ||
    ""
  );
}

function getDisplayTime(slot) {
  const status = getSlotStatus(slot);
  const originalTime = formatTime(slot.time);

  if (status === "時間更改") {
    const changedTime = getChangedTime(slot);

    return `~~${originalTime}~~ → ${formatTime(
      changedTime
    )}`;
  }

  return originalTime;
}

function getStatusLine(slot) {
  const status = getSlotStatus(slot);

  if (status === "取消") {
    return "> 狀態：**已取消**";
  }

  if (status === "時間更改") {
    return "> 狀態：**時間更改**";
  }

  return "> 狀態：**準時**";
}

function getTeamLabel(slot, members = []) {
  const size = getTeamSize(slot, members);
  const type = getTeamType(slot);

  if (type === "爬塔") {
    return `${size}人｜爬塔`;
  }

  return `${size}人｜${type}團`;
}

function getSlotText(team) {
  const { slot, members } = team;

  const currentMemberCount = members.length;
  const maximumMemberCount = getTeamSize(
    slot,
    members
  );

  const roleCount = getRoleCount(members);
  const leader = getLeaderName(members);
  const type = getTeamType(slot);

  const lines = [
    `> **${getDisplayTime(
      slot
    )}｜${getTeamLabel(slot, members)}**`,
    getStatusLine(slot),
  ];

  if (type === "爬塔") {
    lines.push(
      `> 難度：**${getTowerDifficulty(slot)}**`
    );

    lines.push(
      `> 層數：**${getTowerFloor(
        slot,
        members
      )}**`
    );
  }

  lines.push(`> 開團：**${leader}**`);

  lines.push(
    `> 輸出 ${roleCount.dps}｜承傷 ${roleCount.tank}｜治療 ${roleCount.heal} ｜ 👥 \`${currentMemberCount}/${maximumMemberCount}\``
  );

  return lines.join("\n");
}

// ==========================================
// Read Firestore data
// ==========================================

function extractTeamsFromDocument(
  documentSnapshot
) {
  if (!documentSnapshot.exists) {
    return [];
  }

  const dateId = documentSnapshot.id;
  const data = documentSnapshot.data() || {};

  const slots = Array.isArray(data.slots)
    ? data.slots
    : [];

  const teams = [];

  slots.forEach((slot) => {
    const members = Array.isArray(slot.members)
      ? slot.members
      : [];

    /*
     * Empty teams are not included in the
     * Discord announcement.
     */
    if (members.length === 0) {
      return;
    }

    teams.push({
      dateId,
      slot,
      members,
    });
  });

  return teams;
}

async function getTodayTeams(todayId) {
  const documentSnapshot = await db
    .collection("schedule")
    .doc(todayId)
    .get();

  return extractTeamsFromDocument(
    documentSnapshot
  );
}

async function getAllFutureTeams(todayId) {
  const querySnapshot = await db
    .collection("schedule")
    .where(
      admin.firestore.FieldPath.documentId(),
      ">=",
      todayId
    )
    .get();

  const teams = [];

  querySnapshot.forEach(
    (documentSnapshot) => {
      teams.push(
        ...extractTeamsFromDocument(
          documentSnapshot
        )
      );
    }
  );

  return teams;
}

function sortTeams(teams) {
  return teams.sort((teamA, teamB) => {
    const dateComparison =
      teamA.dateId.localeCompare(teamB.dateId);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    const timeA = String(
      teamA.slot.time || ""
    );

    const timeB = String(
      teamB.slot.time || ""
    );

    return timeA.localeCompare(timeB);
  });
}

function groupTeamsByDate(teams) {
  const groupedTeams = {};

  teams.forEach((team) => {
    if (!groupedTeams[team.dateId]) {
      groupedTeams[team.dateId] = [];
    }

    groupedTeams[team.dateId].push(team);
  });

  return groupedTeams;
}

// ==========================================
// Discord message construction
// ==========================================

function buildDescription(
  teams,
  emptyMessage
) {
  if (teams.length === 0) {
    return emptyMessage;
  }

  const groupedTeams =
    groupTeamsByDate(teams);

  let description = "";

  Object.keys(groupedTeams)
    .sort()
    .forEach((dateId) => {
      const teamsText = groupedTeams[dateId]
        .map((team) => getSlotText(team))
        .join("\n\n");

      description +=
        `## ${formatDateTitle(dateId)}\n\n` +
        `${teamsText}\n\n`;
    });

  if (description.length > 3800) {
    description =
      description.slice(0, 3600) +
      "\n\n隊伍數量較多，請到報名頁查看完整列表。";
  }

  return description.trim();
}

async function sendDiscord(payload) {
  const response = await fetch(WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responseText =
      await response.text();

    throw new Error(
      `Discord webhook failed: ${response.status} ${responseText}`
    );
  }
}

async function sendRecruitmentMessage({
  title,
  description,
  footerText,
}) {
  await sendDiscord({
    embeds: [
      {
        title,
        description,
        color: 13326982,
        fields: [
          {
            name: "報名連結",
            value: `[點此進入報名頁](${SITE_URL})`,
            inline: false,
          },
        ],
        footer: {
          text: footerText,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

// ==========================================
// Daily announcement
// ==========================================

async function runDailyAnnouncement(
  todayId
) {
  console.log(
    `Running daily announcement for ${todayId}`
  );

  const teams = sortTeams(
    await getTodayTeams(todayId)
  );

  /*
   * At noon, do not send anything when
   * there are no registered teams today.
   */
  if (teams.length === 0) {
    console.log(
      "No registered teams today. Discord message skipped."
    );

    return;
  }

  const description = buildDescription(
    teams,
    "今天暫時沒有已報名的隊伍。"
  );

  await sendRecruitmentMessage({
    title: "今日副本招募",
    description,
    footerText:
      "夢回花深處｜每日中午自動公告",
  });

  console.log(
    `Daily announcement sent. Teams: ${teams.length}`
  );
}

// ==========================================
// Saturday announcement
// ==========================================

async function runWeeklyAnnouncement(
  todayId
) {
  console.log(
    `Running Saturday future-team announcement from ${todayId}`
  );

  const teams = sortTeams(
    await getAllFutureTeams(todayId)
  );

  /*
   * Saturday will always send one message,
   * even when no future team currently exists.
   */
  const description = buildDescription(
    teams,
    "目前暫時沒有已報名的未來隊伍。"
  );

  await sendRecruitmentMessage({
    title: "未來副本招募清單",
    description,
    footerText:
      "夢回花深處｜每週六未來隊伍公告",
  });

  console.log(
    `Saturday announcement sent. Teams: ${teams.length}`
  );
}

// ==========================================
// Main
// ==========================================

async function main() {
  const todayId = getMalaysiaDateId();

  console.log(`Malaysia date: ${todayId}`);
  console.log(`Run mode: ${RUN_MODE}`);

  if (RUN_MODE === "daily") {
    await runDailyAnnouncement(todayId);
    return;
  }

  if (RUN_MODE === "weekly") {
    await runWeeklyAnnouncement(todayId);
    return;
  }

  throw new Error(
    `Invalid RUN_MODE "${RUN_MODE}". Use "daily" or "weekly".`
  );
}

main().catch((error) => {
  console.error(
    "Recruitment announcement failed:"
  );

  console.error(error);

  process.exit(1);
});
