const core = require("@actions/core");
const axios = require("axios");
const fs = require("fs");
const exec = require("./exec");

const TODOIST_API_KEY = core.getInput("TODOIST_API_KEY");

const README_FILE_PATH = "./README.md";

async function main() {
  try {
    const today = new Date();
    const since = new Date();

    since.setDate(today.getDate() - 365);

    const response = await axios.get("https://api.todoist.com/api/v1/tasks/completed/by_completion_date", {
      headers: {
        Authorization: `Bearer ${TODOIST_API_KEY}`,
      },
      params: {
        since: since.toISOString(),
        until: today.toISOString(),
        limit: 200,
      },
    });

    const tasks = response.data.items || [];

    const stats = calculateStats(tasks);

    await updateReadme(stats);
  } catch (error) {
    core.setFailed(error.message);
  }
}

function calculateStats(tasks) {
  const today = new Date().toISOString().slice(0, 10);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  let todayCount = 0;
  let weekCount = 0;

  const days = new Set();

  tasks.forEach((task) => {
    const date = (task.completed_at || task.completed_date || "").slice(0, 10);

    if (!date) return;

    days.add(date);

    if (date === today) {
      todayCount++;
    }

    if (new Date(date) >= weekAgo) {
      weekCount++;
    }
  });

  const sortedDays = [...days].sort().reverse();

  let streak = 0;
  let current = new Date();

  for (let day of sortedDays) {
    const d = new Date(day);

    if (d.toISOString().slice(0, 10) === current.toISOString().slice(0, 10)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }

  const total = tasks.length;

  const karma = total * 10;

  return {
    karma,
    todayCount,
    weekCount,
    total,
    streak,
  };
}

async function updateReadme(stats) {
  const { karma, todayCount, weekCount, total, streak } = stats;

  const content = `

<img src="https://media.giphy.com/media/pLdVWrcyYuDbA1gzRC/giphy.gif" width="20"> Possuo **${karma}** pontos de Karma;           
<img src="https://media.giphy.com/media/toPQKsvkZn12WROprz/giphy.gif" width="20"> Completei **${todayCount}** tarefas hoje;           
<img src="https://media.giphy.com/media/iVytKHg54kvEbSOyJe/giphy.gif" width="20"> Completei **${weekCount}** tarefas essa semana;           
<img src="https://media.giphy.com/media/fLfIiS0UhOh2ruaX0m/giphy.gif" width="20"> Completei **${total}** tarefas no total;           
<img src="https://media.giphy.com/media/2iktjYc84MxU9Izzfb/giphy.gif" width="20"> Sequência mais longa é de **${streak}** dias;

`;

  const readme = fs.readFileSync(README_FILE_PATH, "utf8");

  const start = "<!-- TODO-IST:START -->";
  const end = "<!-- TODO-IST:END -->";

  const newReadme = readme.replace(
    new RegExp(`${start}[\\s\\S]*${end}`),

    `${start}\n${content}\n${end}`,
  );

  fs.writeFileSync(README_FILE_PATH, newReadme);

  await commitReadme();
}

async function commitReadme() {
  const committerUsername = "github-actions";
  const committerEmail = "github-actions@github.com";

  await exec("git", ["config", "--global", "user.email", committerEmail]);
  await exec("git", ["config", "--global", "user.name", committerUsername]);

  await exec("git", ["add", "README.md"]);
  await exec("git", ["commit", "-m", "Todoist stats updated"]);
  await exec("git", ["push"]);
}

main();
