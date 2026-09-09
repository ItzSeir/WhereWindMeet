const {
  initializeApp,
  cert,
} = require("firebase-admin/app");

const {
  getFirestore,
  FieldPath,
} = require("firebase-admin/firestore");

// ==========================================
// Environment variables
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

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(
      /\\n/g,
      "\n"
    ),
  }),
});

const db = getFirestore();

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
// Date helpers
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

  if (!year || !month || !day) {
    throw new Error(
      "Unable to determine Malaysia date."
    );
  }

  return `${year}-${month}-${day}`;
}

function addDaysToDateId(dateId, days) {
  const [year, month, day] = dateId
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0"),
    String(
      date.getUTCDate()
    ).padStart(2, "0"),
  ].join("-");
}

function formatDateTitle(dateId) {
  const [year, month, day] = dateId
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  const weekday =
    WEEKDAY_MAP[date.getUTCDay()];

  return `${month}月${day}日（${weekday}）`;
}

function formatTime(time = "") {
  if (!time) {
    return "未設定時間";
  }

  const normalizedTime =
    String(time).trim();

  const match = normalizedTime.match(
    /^(\d{1,2}):(\d{1,2})$/
  );

  if (!match) {
    return normalizedTime;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return normalizedTime;
  }

  return `${String(hour).padStart(
    2,
    "0"
  )}:${String(minute).padStart(
    2,
    "0"
  )}`;
}

function parseTimeToMinutes(time = "") {
  const normalizedTime =
    String(time).trim();

  const match = normalizedTime.match(
    /^(\d{1,2}):(\d{1,2})$/
  );

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

// ==========================================
// Team helpers
// ==========================================

function cleanType(rawType = "普通") {
  return String(
    rawType || "普通"
  ).replace(/團$/g, "");
}

function getTeamType(slot = {}) {
  return cleanType(
    slot.teamType ||
      slot.type ||
      slot.activityType ||
      "普通"
  );
}

function getTeamSize(
  slot = {},
  members = []
) {
  const size = Number(
    slot.teamSize ??
      slot.size ??
      slot.teamSizeValue
  );

  if (
    Number.isFinite(size) &&
    size > 0
  ) {
    return size;
  }

  if (members.length > 5) {
    return 10;
  }

  return 10;
}

function getRoleCount(members = []) {
  let dps = 0;
  let tank = 0;
  let heal = 0;

  const fakeHealers = [];

  members.forEach((member) => {
    const role = member?.role;

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

function getLeaderName(
  members = []
) {
  return members[0]?.name || "隊長";
}

function getTowerDifficulty(
  slot = {}
) {
  return (
    slot.towerDifficulty ??
    slot.difficulty ??
    slot.towerMode ??
    slot.towerLevelDifficulty ??
    "未設定難度"
  );
}

function getTowerFloor(
  slot = {},
  members = []
) {
  const type = getTeamType(slot);

  if (type !== "爬塔") {
    return "";
  }

  const start =
    slot.towerFloorStart;

  const end =
    slot.towerFloorEnd;

  const single =
    slot.towerFloor;

  if (
    start !== null &&
    start !== undefined &&
    end !== null &&
    end !== undefined
  ) {
    if (
      String(start) ===
      String(end)
    ) {
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

  const size =
    getTeamSize(slot, members);

  return size === 5
    ? "1-5層"
    : "1-10層";
}

function getSlotStatus(slot = {}) {
  return (
    slot.status ||
    slot.slotStatus ||
    "準時"
  );
}

function getChangedTime(slot = {}) {
  return (
    slot.changedTime ||
    slot.newTime ||
    slot.updatedTime ||
    ""
  );
}

function getEffectiveSlotTime(
  slot = {}
) {
  const status =
    getSlotStatus(slot);

  if (status === "時間更改") {
    return (
      getChangedTime(slot) ||
      slot.time ||
      ""
    );
  }

  return slot.time || "";
}

function isBeforeNoon(slot = {}) {
  const totalMinutes =
    parseTimeToMinutes(
      getEffectiveSlotTime(slot)
    );

  if (totalMinutes === null) {
    return false;
  }

  return totalMinutes < 720;
}

function getDisplayTime(
  slot = {}
) {
  const status =
    getSlotStatus(slot);

  const originalTime =
    formatTime(slot.time);

  if (status === "時間更改") {
    const changedTime =
      getChangedTime(slot);

    if (!changedTime) {
      return originalTime;
    }

    return `~~${originalTime}~~ → ${formatTime(
      changedTime
    )}`;
  }

  return originalTime;
}

function getStatusLine(slot = {}) {
  const status =
    getSlotStatus(slot);

  if (status === "取消") {
    return "❌ **狀態**　已取消";
  }

  if (status === "時間更改") {
    return "🕒 **狀態**　時間已更改";
  }

  return "✅ **狀態**　準時";
}

function getTeamLabel(
  slot = {},
  members = []
) {
  const size =
    getTeamSize(slot, members);

  const type =
    getTeamType(slot);

  if (type === "爬塔") {
    return `${size}人｜爬塔`;
  }

  return `${size}人｜${type}團`;
}

function getSlotText(team) {
  const { slot, members } = team;

  const memberCount =
    members.length;

  const maximum =
    getTeamSize(slot, members);

  const roleCount =
    getRoleCount(members);

  const leader =
    getLeaderName(members);

  const type =
    getTeamType(slot);

  const lines = [];

  lines.push(
    `### 🕘 ${getDisplayTime(slot)}　${getTeamLabel(
      slot,
      members
    )}`
  );

  lines.push(
    `👤 **隊長**　${leader}`
  );

  lines.push(
    `👥 **隊伍人數**　${memberCount}/${maximum} 人`
  );

  lines.push(
    `⚔️ 輸出 **${roleCount.dps}**　` +
    `🛡️ 承傷 **${roleCount.tank}**　` +
    `💚 治療 **${roleCount.heal}**`
  );

  if (type === "爬塔") {
    lines.push(
      `🏯 **層數**　${getTowerFloor(
        slot,
        members
      )}　｜　⚙️ **難度**　${getTowerDifficulty(
        slot
      )}`
    );
  }

  lines.push(
    getStatusLine(slot)
  );

  return lines.join("\n");
}

// ==========================================
// Firestore reading
// ==========================================

function extractTeamsFromDocument(
  documentSnapshot
) {
  if (!documentSnapshot.exists) {
    return [];
  }

  const dateId =
    documentSnapshot.id;

  const data =
    documentSnapshot.data() || {};

  const slots =
    Array.isArray(data.slots)
      ? data.slots
      : [];

  const teams = [];

  slots.forEach((slot) => {
    if (
      !slot ||
      typeof slot !== "object"
    ) {
      return;
    }

    const members =
      Array.isArray(slot.members)
        ? slot.members
        : [];

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

async function getDailyAnnouncementTeams(
  todayId
) {
  const tomorrowId =
    addDaysToDateId(todayId, 1);

  const [
    todaySnapshot,
    tomorrowSnapshot,
  ] = await Promise.all([
    db
      .collection("schedule")
      .doc(todayId)
      .get(),

    db
      .collection("schedule")
      .doc(tomorrowId)
      .get(),
  ]);

  const todayTeams =
    extractTeamsFromDocument(
      todaySnapshot
    );

  const tomorrowTeams =
    extractTeamsFromDocument(
      tomorrowSnapshot
    ).filter((team) =>
      isBeforeNoon(team.slot)
    );

  return [
    ...todayTeams,
    ...tomorrowTeams,
  ];
}

async function getAllFutureTeams(
  todayId
) {
  const querySnapshot = await db
    .collection("schedule")
    .where(
      FieldPath.documentId(),
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

// ==========================================
// Sorting and grouping
// ==========================================

function sortTeams(teams) {
  return [...teams].sort(
    (teamA, teamB) => {
      const dateComparison =
        teamA.dateId.localeCompare(
          teamB.dateId
        );

      if (dateComparison !== 0) {
        return dateComparison;
      }

      const minutesA =
        parseTimeToMinutes(
          getEffectiveSlotTime(
            teamA.slot
          )
        );

      const minutesB =
        parseTimeToMinutes(
          getEffectiveSlotTime(
            teamB.slot
          )
        );

      if (
        minutesA !== null &&
        minutesB !== null
      ) {
        return minutesA - minutesB;
      }

      if (minutesA !== null) {
        return -1;
      }

      if (minutesB !== null) {
        return 1;
      }

      return 0;
    }
  );
}

function groupTeamsByDate(
  teams
) {
  const grouped = {};

  teams.forEach((team) => {
    if (!grouped[team.dateId]) {
      grouped[team.dateId] = [];
    }

    grouped[team.dateId].push(
      team
    );
  });

  return grouped;
}

// ==========================================
// Discord
// ==========================================

function buildDescription(
  teams,
  emptyMessage
) {
  if (teams.length === 0) {
    return emptyMessage;
  }

  const grouped =
    groupTeamsByDate(teams);

  let description = "";

  Object.keys(grouped)
    .sort()
    .forEach((dateId) => {
      const teamsText =
        grouped[dateId]
          .map((team) =>
            getSlotText(team)
          )
          .join("\n\n");

      description +=
        `## 📅 ${formatDateTitle(
          dateId
        )}\n${teamsText}\n\n`;
    });

  if (description.length > 3800) {
    description =
      description.slice(
        0,
        3600
      ) +
      "\n\n隊伍較多，請前往報名頁查看完整內容。";
  }

  return description.trim();
}

async function sendDiscord(
  payload
) {
  const response = await fetch(
    WEBHOOK,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(
        payload
      ),
    }
  );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `Discord webhook failed: ${response.status} ${text}`
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
            name: "🔗 查看隊伍與報名",
            value: `[前往副本報名頁](${SITE_URL})`,
            inline: false,
          },
        ],
        footer: {
          text: footerText,
        },
        timestamp:
          new Date().toISOString(),
      },
    ],
  });
}

// ==========================================
// Daily
// ==========================================

async function runDailyAnnouncement(
  todayId
) {
  const tomorrowId =
    addDaysToDateId(todayId, 1);

  console.log(
    `Daily mode: ${todayId}`
  );

  console.log(
    `Also checking ${tomorrowId} before 12:00 PM`
  );

  const teams = sortTeams(
    await getDailyAnnouncementTeams(
      todayId
    )
  );

  console.log(
    `Daily teams found: ${teams.length}`
  );

  if (teams.length === 0) {
    console.log(
      "No teams found. Discord message skipped."
    );

    return;
  }

  const teamList =
    buildDescription(
      teams,
      "今天暫時沒有需要提醒的副本隊伍。"
    );

  const description = [
    "早安！以下是今天的 **副本組隊安排**。",
    "同時列出 **明天中午前** 已有成員的隊伍，方便大家提前確認時間。",
    "",
    teamList,
  ].join("\n");

  await sendRecruitmentMessage({
    title:
      "☀️ 今日副本組隊提醒",
    description,
    footerText:
      "夢回花深處｜每日 08:00 組隊提醒",
  });

  console.log(
    "Daily announcement sent."
  );
}

// ==========================================
// Weekly
// ==========================================

async function runWeeklyAnnouncement(
  todayId
) {
  console.log(
    `Weekly mode from ${todayId}`
  );

  const teams = sortTeams(
    await getAllFutureTeams(
      todayId
    )
  );

  console.log(
    `Future teams found: ${teams.length}`
  );

  const teamList =
    buildDescription(
      teams,
      "目前暫時沒有已報名的未來隊伍。"
    );

  const description = [
    "以下整理目前已建立並有成員報名的 **未來副本隊伍**。",
    "如有時間更改或取消，請以報名頁最新狀態為準。",
    "",
    teamList,
  ].join("\n");

  await sendRecruitmentMessage({
    title:
      "📅 未來副本組隊一覽",
    description,
    footerText:
      "夢回花深處｜每週六組隊整理",
  });

  console.log(
    "Weekly announcement sent."
  );
}

// ==========================================
// Main
// ==========================================

async function main() {
  const todayId =
    getMalaysiaDateId();

  console.log(
    `Malaysia date: ${todayId}`
  );

  console.log(
    `Run mode: ${RUN_MODE}`
  );

  if (RUN_MODE === "daily") {
    await runDailyAnnouncement(
      todayId
    );

    return;
  }

  if (RUN_MODE === "weekly") {
    await runWeeklyAnnouncement(
      todayId
    );

    return;
  }

  throw new Error(
    `Invalid RUN_MODE "${RUN_MODE}".`
  );
}

main().catch((error) => {
  console.error(
    "Recruitment announcement failed:"
  );

  console.error(error);

  process.exit(1);
});
