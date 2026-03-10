const core = require("@actions/core");
const axios = require("axios");
const Humanize = require("humanize-plus");
const fs = require("fs");
const exec = require("./exec");

const TODOIST_API_KEY = core.getInput("TODOIST_API_KEY");
const PREMIUM = core.getInput("PREMIUM");

let todoist = [];
let jobFailFlag = false;
const README_FILE_PATH = "./README.md";

async function main() {
  try {
    const res = await axios("https://api.todoist.com/api/v1/tasks/completed/by_completion_date", {
      headers: { Authorization: `Bearer ${TODOIST_API_KEY}` },
      params: { limit: 200 },
    });

    const tasks = res.data.items || [];

    const stats = buildStats(tasks);

    await updateReadme(stats);
  } catch (err) {
    core.error(err);
    process.exit(1);
  }
}

function buildStats(tasks) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  let todayCount = 0;
  let weekCount = 0;

  const completionDays = new Set();

  tasks.forEach((task) => {
    const date = task.completed_at.slice(0, 10);
    const taskDate = new Date(date);

    completionDays.add(date);

    if (date === todayStr) {
      todayCount++;
    }

    if (taskDate >= startOfWeek) {
      weekCount++;
    }
  });

  const streakData = calculateStreak(completionDays);

  return {
    karma: tasks.length * 10, // estimativa simples
    completed_count: tasks.length,
    days_items: [{ total_completed: todayCount }],
    week_items: [{ total_completed: weekCount }],
    goals: {
      max_daily_streak: { count: streakData.longest },
      current_daily_streak: { count: streakData.current },
    },
  };
}

function calculateStreak(daysSet) {
  const sortedDays = Array.from(daysSet)
    .map((d) => new Date(d))
    .sort((a, b) => b - a);

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;

  let prevDate = null;

  sortedDays.forEach((date) => {
    if (!prevDate) {
      streak = 1;
    } else {
      const diff = (prevDate - date) / (1000 * 60 * 60 * 24);

      if (diff === 1) {
        streak++;
      } else {
        streak = 1;
      }
    }

    longestStreak = Math.max(longestStreak, streak);
    prevDate = date;
  });

  const today = new Date().toISOString().slice(0, 10);

  if (daysSet.has(today)) {
    currentStreak = streak;
  }

  return {
    current: currentStreak,
    longest: longestStreak,
  };
}

async function updateReadme(data) {
  const { karma, completed_count, days_items, goals, week_items } = data;

  const karmaPoint = [`🏆  **${Humanize.intComma(karma)}** Karma Points`];
  todoist.push(karmaPoint);

  const dailyGoal = [`🌸  Completed **${days_items[0].total_completed.toString()}** tasks today`];
  todoist.push(dailyGoal);

  if (PREMIUM == "true") {
    const weekItems = [`🗓  Completed **${week_items[0].total_completed.toString()}** tasks this week`];
    todoist.push(weekItems);
  }

  const totalTasks = [`✅  Completed **${Humanize.intComma(completed_count)}** tasks so far`];
  todoist.push(totalTasks);

  const longestStreak = [`⏳  Longest streak is **${goals.max_daily_streak.count}** days`];
  todoist.push(longestStreak);

  if (todoist.length === 0) return;

  const readmeData = fs.readFileSync(README_FILE_PATH, "utf8");

  const newReadme = buildReadme(readmeData, todoist.join("           \n"));

  if (newReadme !== readmeData) {
    core.info("Writing to " + README_FILE_PATH);

    fs.writeFileSync(README_FILE_PATH, newReadme);

    if (!process.env.TEST_MODE) {
      await commitReadme();
    }
  } else {
    core.info("No change detected, skipping");
    process.exit(0);
  }
}

const buildReadme = (prevReadmeContent, newReadmeContent) => {
  const tagToLookFor = "<!-- TODO-IST:";
  const closingTag = "-->";

  const startOfOpeningTagIndex = prevReadmeContent.indexOf(`${tagToLookFor}START`);

  const endOfOpeningTagIndex = prevReadmeContent.indexOf(closingTag, startOfOpeningTagIndex);

  const startOfClosingTagIndex = prevReadmeContent.indexOf(`${tagToLookFor}END`, endOfOpeningTagIndex);

  if (startOfOpeningTagIndex === -1 || endOfOpeningTagIndex === -1 || startOfClosingTagIndex === -1) {
    core.error(
      `Cannot find the comment tag on the readme:
<!-- TODO-IST:START -->
<!-- TODO-IST:END -->`,
    );

    process.exit(1);
  }

  return [prevReadmeContent.slice(0, endOfOpeningTagIndex + closingTag.length), "\n", newReadmeContent, "\n", prevReadmeContent.slice(startOfClosingTagIndex)].join("");
};

const commitReadme = async () => {
  const committerUsername = "Todoist Bot";
  const committerEmail = "actions@github.com";
  const commitMessage = "Update Todoist stats";

  await exec("git", ["config", "--global", "user.email", committerEmail]);
  await exec("git", ["config", "--global", "user.name", committerUsername]);

  await exec("git", ["add", README_FILE_PATH]);

  await exec("git", ["commit", "-m", commitMessage]);

  await exec("git", ["push"]);

  core.info("Readme updated successfully.");

  process.exit(jobFailFlag ? 1 : 0);
};

(async () => {
  await main();
})();
